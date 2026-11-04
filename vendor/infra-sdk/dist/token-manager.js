/**
 * Access-token lifecycle for a child app.
 *
 * An access token lives ten minutes. The naive handling — let it expire, get a 401, refresh, retry
 * — is not merely wasteful here, it is *incorrect*, and the reason is a feature this platform
 * deliberately has:
 *
 * Refresh tokens rotate, and a replayed one triggers reuse detection, which revokes **every
 * session in the family** (see rotateRefreshToken in @infra/db). So when a page fires five requests
 * at once with a stale token, five 401s come back, five refreshes start, one wins, and the other
 * four present a token the server has just burned. The server does exactly what it was built to
 * do — concludes the token was stolen and logs the user out of everything. The user experiences it
 * as "the app randomly signs me out under load", and every layer is behaving correctly.
 *
 * The fix is that a client must never have two refreshes in flight. Hence:
 *
 *   - **Single-flight.** The first caller to need a refresh starts it; everyone else awaits the
 *     same promise. One network call, one rotation, one new token for all of them.
 *   - **Proactive.** The token is refreshed shortly *before* expiry, so in the common case nobody
 *     is ever waiting on it and no request ever sees a 401.
 *   - **One retry, never a loop.** A 401 that survives a fresh token is a real authorisation
 *     failure, not a stale one.
 *   - **A revoked family is terminal.** When the server reports reuse detection there is nothing
 *     to retry: the tokens are gone. The manager clears its state and says so, rather than
 *     hammering an endpoint that will keep refusing.
 *
 * Nothing here is a singleton. On a server, one manager per request — see createServerClient.
 */
export const DEFAULT_SKEW_MS = 60_000;
export class TokenManager {
    options;
    inFlight = null;
    cached = null;
    ended = false;
    skewMs;
    now;
    constructor(options) {
        this.options = options;
        this.skewMs = options.skewMs ?? DEFAULT_SKEW_MS;
        this.now = options.now ?? (() => Date.now());
    }
    /** True once the server has told us the session is gone; no call will succeed after this. */
    get sessionEnded() {
        return this.ended;
    }
    isExpiring(pair) {
        return pair.expiresAt - this.skewMs <= this.now();
    }
    /**
     * The access token to send, refreshing first if it is close to expiry.
     *
     * Returns null when there is no session — which is a normal state (nobody signed in), not an
     * error, so the caller decides whether that is a problem.
     */
    async getAccessToken() {
        if (this.ended)
            return null;
        const pair = this.cached ?? (await this.options.storage.load());
        if (pair === null)
            return null;
        this.cached = pair;
        if (!this.isExpiring(pair))
            return pair.accessToken;
        const refreshed = await this.refreshOnce(pair.refreshToken);
        return refreshed?.accessToken ?? null;
    }
    /**
     * Starts a refresh, or joins the one already running.
     *
     * The whole class exists for these six lines. Every caller that arrives while a refresh is in
     * flight gets the *same* promise, so the rotating refresh token is presented exactly once.
     */
    async refreshOnce(refreshToken) {
        this.inFlight ??= this.performRefresh(refreshToken).finally(() => {
            this.inFlight = null;
        });
        return this.inFlight;
    }
    async performRefresh(refreshToken) {
        const outcome = await this.options.refresh(refreshToken);
        if (outcome.terminal !== undefined) {
            await this.endSession(outcome.terminal.message);
            return null;
        }
        if (outcome.pair === null)
            return null;
        this.cached = outcome.pair;
        await this.options.storage.save(outcome.pair);
        return outcome.pair;
    }
    /** Called after a 401 on a request that already carried a fresh-looking token. */
    async forceRefresh() {
        if (this.ended)
            return null;
        const pair = this.cached ?? (await this.options.storage.load());
        if (pair === null)
            return null;
        const refreshed = await this.refreshOnce(pair.refreshToken);
        return refreshed?.accessToken ?? null;
    }
    async setTokens(pair) {
        this.ended = false;
        this.cached = pair;
        await this.options.storage.save(pair);
    }
    async endSession(reason = 'signed out') {
        this.ended = true;
        this.cached = null;
        await this.options.storage.clear();
        this.options.onSessionEnded?.(reason);
    }
}
/** Errors from which no retry helps — the credentials themselves are gone. */
export const TERMINAL_REFRESH_CODES = ['UNAUTHENTICATED', 'API_KEY_REVOKED'];
/**
 * Recognises the server's reuse-detection response.
 *
 * Worth singling out from an ordinary 401: this one means somebody presented a burned token and
 * the whole family was revoked. It should end the session immediately and, in an app that cares,
 * be surfaced to the user — it is either a bug in their client or a stolen token being replayed.
 */
export function isReuseDetected(error) {
    if (error === null)
        return false;
    return error.code === 'UNAUTHENTICATED' && /reuse|already been used|already used/i.test(error.message ?? '');
}
/** An in-memory store, for a browser tab or a test. */
export function memoryStorage(initial = null) {
    let pair = initial;
    return {
        load: () => pair,
        save: (next) => {
            pair = next;
        },
        clear: () => {
            pair = null;
        },
    };
}
//# sourceMappingURL=token-manager.js.map