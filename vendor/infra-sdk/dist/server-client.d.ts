/**
 * `createServerClient()` — the client a child app's **server** uses.
 *
 * The difference from `createInfraClient` is not the feature list, it is the lifetime. A browser
 * client is one object serving one user for as long as the tab is open. A server client looks the
 * same and is not: the same process serves thousands of users, and any user state that outlives a
 * request is a cross-user leak.
 */
import { QueryBuilder } from './query-builder.js';
import { type InfraStorageClient } from './storage.js';
import { type InfraWorkspacesClient } from './workspaces.js';
import { type InfraNotificationsClient } from './notifications.js';
import { type InfraSecretsClient } from './secrets.js';
import { type InfraSettingsClient } from './settings.js';
import { type InfraInvitationsClient } from './invitations.js';
import { type InfraMailClient } from './mail.js';
import { type InfraAiClient } from './ai.js';
import { type InfraActivityClient } from './activity.js';
import { type InfraHealthClient } from './health.js';
import { TokenManager, type RefreshOutcome, type TokenPair, type TokenStorage } from './token-manager.js';
import type { InfraAuthClient, InfraClientOptions, InfraDbClient, Result } from './types.js';
/** What /api/v1/me answers for a signed-in person. */
export interface MeResponse {
    user: {
        id: string;
        email: string | null;
        name: string | null;
        image: string | null;
    };
    appId: string;
    roles: string[];
    workspaceId: string | null;
    sessionId: string;
    expiresAt: string;
}
export interface ExchangeCodeInput {
    code: string;
    codeVerifier: string;
    /** Must be byte-for-byte the redirect_uri that started the flow. */
    redirectUri: string;
}
export interface ServerClientOptions extends InfraClientOptions {
    /** Where this request's tokens are read from and written back to. Required — see above. */
    storage: TokenStorage;
    /** Called once when the session ends for good, so the app can redirect to sign-in. */
    onSessionEnded?: (reason: string) => void;
    skewMs?: number;
    /**
     * The tokens can be read here but not written — a React Server Component render, where
     * `cookies().set()` throws. Such a client never refreshes: a refresh burns the old refresh
     * token at the hub, and with nowhere to store the new one the next request presents the burned
     * one, trips reuse detection and signs the person out of every session. Refresh belongs in
     * middleware/proxy or a Server Action instead; see examples/clientdesk.
     */
    readOnly?: boolean;
}
export interface InfraServerClient {
    readonly baseUrl: string;
    auth: InfraAuthClient;
    /** Raw SQL. Available here because a server may legitimately hold an `sk_` key. */
    db: InfraDbClient;
    from: <R = Record<string, unknown>>(resource: string) => QueryBuilder<R>;
    /** The current access token, refreshed if it is about to expire. Null when nobody is signed in. */
    accessToken: () => Promise<string | null>;
    /** Store a freshly-minted pair, e.g. straight after sign-in. */
    setSession: (pair: TokenPair) => Promise<void>;
    /** Clear the session locally and tell the hub to revoke the refresh token. */
    signOut: () => Promise<Result<null>>;
    /**
     * Finish hosted sign-in: trade the one-time code from the hub's redirect for a token pair, and
     * store it. Requires the app's `sk_` key — the reason a code intercepted on the way back is
     * worthless to anyone but this app's server.
     */
    exchangeCode: (input: ExchangeCodeInput) => Promise<Result<TokenPair>>;
    /** The signed-in person, or `null` when nobody is. Sends this request's access token. */
    me: () => Promise<Result<MeResponse | null>>;
    /** Files, as the signed-in user (or as the app's server when nobody is). */
    storage: InfraStorageClient;
    /** Workspaces and team multi-tenancy. */
    workspaces: InfraWorkspacesClient;
    /** In-app inbox notifications. */
    notifications: InfraNotificationsClient;
    /** Encrypted per-user secrets vault. */
    secrets: InfraSecretsClient;
    /** User settings and preferences. */
    settings: InfraSettingsClient;
    /** User invitations management. */
    invitations: InfraInvitationsClient;
    /** Mail client for sending transactional emails (requires sk_ key). */
    mail: InfraMailClient;
    /** AI Gateway client with fallback and streaming. */
    ai: InfraAiClient;
    /** Sub-app activity & audit feed client. */
    activity: InfraActivityClient;
    /** Health check and monitoring. */
    health: InfraHealthClient;
    tokens: TokenManager;
}
interface TokenPairBody {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
}
export declare function toTokenPair(body: TokenPairBody | null | undefined, now?: number): TokenPair | null;
export declare function refreshTokenPair(options: InfraClientOptions, refreshToken: string): Promise<RefreshOutcome>;
export declare function createServerClient(options: ServerClientOptions): InfraServerClient;
export {};
//# sourceMappingURL=server-client.d.ts.map