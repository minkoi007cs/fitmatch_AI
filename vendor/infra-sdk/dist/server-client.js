/**
 * `createServerClient()` — the client a child app's **server** uses.
 *
 * The difference from `createInfraClient` is not the feature list, it is the lifetime. A browser
 * client is one object serving one user for as long as the tab is open. A server client looks the
 * same and is not: the same process serves thousands of users, and any user state that outlives a
 * request is a cross-user leak.
 */
import { QueryBuilder } from './query-builder.js';
import { createAuthClient } from './auth.js';
import { createDbClient } from './db.js';
import { createStorageClient } from './storage.js';
import { createWorkspacesClient } from './workspaces.js';
import { createNotificationsClient } from './notifications.js';
import { createSecretsClient } from './secrets.js';
import { createSettingsClient } from './settings.js';
import { createInvitationsClient } from './invitations.js';
import { createMailClient } from './mail.js';
import { createAiClient } from './ai.js';
import { createActivityClient } from './activity.js';
import { createHealthClient } from './health.js';
import { normaliseBaseUrl, request } from './http.js';
import { isReuseDetected, TokenManager, } from './token-manager.js';
export function toTokenPair(body, now = Date.now()) {
    if (body === null || body === undefined)
        return null;
    const accessToken = body.accessToken ?? body.access_token;
    const refreshToken = body.refreshToken ?? body.refresh_token;
    const expiresIn = body.expiresIn ?? body.expires_in ?? 600;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string')
        return null;
    return { accessToken, refreshToken, expiresAt: now + expiresIn * 1000 };
}
export async function refreshTokenPair(options, refreshToken) {
    const resolved = { ...options, baseUrl: normaliseBaseUrl(options.baseUrl) };
    const result = await request(resolved, {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        body: { refresh_token: refreshToken },
        useApiKey: true,
    });
    if (result.error !== null) {
        const terminal = isReuseDetected(result.error) || result.error.code === 'UNAUTHENTICATED'
            ? { code: result.error.code, message: result.error.message }
            : undefined;
        return terminal === undefined ? { pair: null } : { pair: null, terminal };
    }
    const pair = toTokenPair(result.data);
    if (pair === null) {
        return { pair: null, terminal: { code: 'INTERNAL', message: 'refresh returned no token pair' } };
    }
    return { pair };
}
export function createServerClient(options) {
    if (typeof options.baseUrl !== 'string' || options.baseUrl.trim() === '') {
        throw new Error('[@infra/sdk] baseUrl is required');
    }
    if (options.storage === undefined || typeof options.storage.load !== 'function') {
        throw new Error('[@infra/sdk] createServerClient requires a storage adapter — per-request token storage is ' +
            'what keeps one user’s session from serving another user’s request');
    }
    if (typeof globalThis === 'object' && 'document' in globalThis) {
        throw new Error('[@infra/sdk] createServerClient is for server code. In a browser use createInfraClient, ' +
            'which refuses secret keys.');
    }
    const resolved = { ...options, baseUrl: normaliseBaseUrl(options.baseUrl) };
    const readOnly = options.readOnly === true;
    const storage = readOnly
        ? {
            load: () => options.storage.load(),
            save: () => undefined,
            clear: () => undefined,
        }
        : options.storage;
    const skewMs = options.skewMs ?? (readOnly ? 5_000 : undefined);
    const tokens = new TokenManager({
        storage,
        ...(skewMs === undefined ? {} : { skewMs }),
        ...(options.onSessionEnded === undefined ? {} : { onSessionEnded: options.onSessionEnded }),
        refresh: readOnly
            ? async () => ({ pair: null })
            : (refreshToken) => refreshTokenPair(resolved, refreshToken),
    });
    const withAuth = async (run) => {
        const token = await tokens.getAccessToken();
        const headers = token === null ? {} : { 'x-infra-access-token': token };
        const first = await run(headers);
        if (first.error === null || first.error.code !== 'UNAUTHENTICATED' || token === null)
            return first;
        if (isReuseDetected(first.error)) {
            await tokens.endSession('refresh token reuse detected');
            return first;
        }
        const refreshed = await tokens.forceRefresh();
        if (refreshed === null)
            return first;
        return run({ 'x-infra-access-token': refreshed });
    };
    const authedOptions = async () => {
        const token = await tokens.getAccessToken();
        if (token === null)
            return resolved;
        return { ...resolved, headers: { ...(resolved.headers ?? {}), 'x-infra-access-token': token } };
    };
    return {
        baseUrl: resolved.baseUrl,
        auth: createAuthClient(resolved),
        db: createDbClient(resolved),
        storage: createStorageClient(resolved, withAuth),
        workspaces: createWorkspacesClient(resolved, withAuth),
        notifications: createNotificationsClient(resolved, withAuth),
        secrets: createSecretsClient(resolved, withAuth),
        settings: createSettingsClient(resolved, withAuth),
        invitations: createInvitationsClient(resolved, withAuth),
        mail: createMailClient(resolved),
        ai: createAiClient(resolved, withAuth),
        activity: createActivityClient(resolved, withAuth),
        health: createHealthClient(resolved),
        tokens,
        from(resource) {
            return new QueryBuilder(resolved, resource, {
                prepare: authedOptions,
                retry: withAuth,
            });
        },
        accessToken: () => tokens.getAccessToken(),
        async exchangeCode(input) {
            const result = await request(resolved, {
                method: 'POST',
                path: '/api/v1/auth/token',
                body: {
                    grant_type: 'authorization_code',
                    code: input.code,
                    code_verifier: input.codeVerifier,
                    redirect_uri: input.redirectUri,
                },
                useApiKey: true,
            });
            if (result.error !== null)
                return { data: null, error: result.error };
            const pair = toTokenPair(result.data);
            if (pair === null) {
                return {
                    data: null,
                    error: { code: 'INTERNAL', message: 'code exchange returned no token pair', requestId: 'unknown' },
                };
            }
            await tokens.setTokens(pair);
            return { data: pair, error: null };
        },
        async me() {
            if ((await tokens.getAccessToken()) === null)
                return { data: null, error: null };
            return withAuth(async (headers) => request({ ...resolved, headers: { ...(resolved.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/me',
                useApiKey: true,
            }));
        },
        setSession: (pair) => tokens.setTokens(pair),
        async signOut() {
            const pair = await options.storage.load();
            await tokens.endSession('signed out');
            if (pair === null)
                return { data: null, error: null };
            return request(resolved, {
                method: 'POST',
                path: '/api/v1/auth/revoke',
                body: { refresh_token: pair.refreshToken },
                useApiKey: true,
            });
        },
    };
}
//# sourceMappingURL=server-client.js.map