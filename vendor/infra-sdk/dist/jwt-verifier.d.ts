/**
 * Client/Satellite JWKS-based JWT token verifier.
 * Designed for microservices and satellite apps to verify Hub minted access tokens locally
 * with automatic JWKS public key caching and rotation support.
 */
export interface RemoteJwtVerifierOptions {
    /** JWKS endpoint URL, e.g. https://hub.example.com/.well-known/jwks.json */
    jwksUrl: string;
    /** Expected issuer (Hub URL), e.g. https://hub.example.com */
    issuer: string;
    /** Expected audience — this app's id. Required: without it a token minted for any other app would pass. */
    audience: string;
    /** Public key cache TTL in milliseconds (default: 30 minutes) */
    cacheTtlMs?: number | undefined;
}
export interface DecodedJwtClaims {
    iss: string;
    sub: string;
    aud: string;
    sid: string;
    typ: string;
    scope: string[];
    roles: string[];
    wid: string | null;
    amr?: string[] | undefined;
    iat: number;
    exp: number;
    jti: string;
    [key: string]: unknown;
}
export declare class RemoteJwtVerifier {
    private readonly jwksUrl;
    private readonly issuer;
    private readonly audience;
    private readonly cacheTtlMs;
    private cachedKeys;
    private lastFetchedAt;
    /** Forced refreshes (unknown `kid`) happen at most once a minute — a stream of junk tokens must not become a stream of JWKS requests. */
    private lastForcedAt;
    constructor(options: RemoteJwtVerifierOptions);
    private fetchJwks;
    /**
     * Verifies the given token and returns its decoded claims.
     * Throws an Error if token is invalid, expired, or untrusted.
     */
    verify(token: string, options?: {
        requiredScopes?: string[];
        clockToleranceSeconds?: number;
    }): Promise<DecodedJwtClaims>;
}
//# sourceMappingURL=jwt-verifier.d.ts.map