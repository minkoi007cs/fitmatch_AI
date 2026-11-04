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
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    /** Epoch milliseconds. */
    expiresAt: number;
}
/** Where the pair is kept between requests: a cookie, a session store, memory in the browser. */
export interface TokenStorage {
    load(): TokenPair | null | Promise<TokenPair | null>;
    save(pair: TokenPair): void | Promise<void>;
    clear(): void | Promise<void>;
}
export interface RefreshOutcome {
    pair: TokenPair | null;
    /** Set when the server refused in a way that no retry can fix. */
    terminal?: {
        code: string;
        message: string;
    };
}
/** Performs the actual network call. Injected so this module stays transport-agnostic. */
export type RefreshFn = (refreshToken: string) => Promise<RefreshOutcome>;
export interface TokenManagerOptions {
    storage: TokenStorage;
    refresh: RefreshFn;
    /**
     * Refresh this long before the token actually expires.
     *
     * Covers clock skew between the child app and the hub plus the flight time of the request the
     * token is about to be used for. Sixty seconds is generous for both, and the cost of being
     * early is one extra rotation per ten minutes.
     */
    skewMs?: number;
    /** Called when the session ends for good, so the app can route to sign-in once. */
    onSessionEnded?: (reason: string) => void;
    now?: () => number;
}
export declare const DEFAULT_SKEW_MS = 60000;
export declare class TokenManager {
    private readonly options;
    private inFlight;
    private cached;
    private ended;
    private readonly skewMs;
    private readonly now;
    constructor(options: TokenManagerOptions);
    /** True once the server has told us the session is gone; no call will succeed after this. */
    get sessionEnded(): boolean;
    isExpiring(pair: TokenPair): boolean;
    /**
     * The access token to send, refreshing first if it is close to expiry.
     *
     * Returns null when there is no session — which is a normal state (nobody signed in), not an
     * error, so the caller decides whether that is a problem.
     */
    getAccessToken(): Promise<string | null>;
    /**
     * Starts a refresh, or joins the one already running.
     *
     * The whole class exists for these six lines. Every caller that arrives while a refresh is in
     * flight gets the *same* promise, so the rotating refresh token is presented exactly once.
     */
    private refreshOnce;
    private performRefresh;
    /** Called after a 401 on a request that already carried a fresh-looking token. */
    forceRefresh(): Promise<string | null>;
    setTokens(pair: TokenPair): Promise<void>;
    endSession(reason?: string): Promise<void>;
}
/** Errors from which no retry helps — the credentials themselves are gone. */
export declare const TERMINAL_REFRESH_CODES: readonly string[];
/**
 * Recognises the server's reuse-detection response.
 *
 * Worth singling out from an ordinary 401: this one means somebody presented a burned token and
 * the whole family was revoked. It should end the session immediately and, in an app that cares,
 * be surfaced to the user — it is either a bug in their client or a stolen token being replayed.
 */
export declare function isReuseDetected(error: {
    code?: string;
    message?: string;
} | null): boolean;
/** An in-memory store, for a browser tab or a test. */
export declare function memoryStorage(initial?: TokenPair | null): TokenStorage;
//# sourceMappingURL=token-manager.d.ts.map