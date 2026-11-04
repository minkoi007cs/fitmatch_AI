/**
 * Client/Satellite JWKS-based JWT token verifier.
 * Designed for microservices and satellite apps to verify Hub minted access tokens locally
 * with automatic JWKS public key caching and rotation support.
 */
function base64UrlDecodeToUint8Array(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
function base64UrlDecodeToString(str) {
    const bytes = base64UrlDecodeToUint8Array(str);
    return new TextDecoder().decode(bytes);
}
const JWKS_TIMEOUT_MS = 5_000;
const FORCED_REFRESH_INTERVAL_MS = 60_000;
export class RemoteJwtVerifier {
    jwksUrl;
    issuer;
    audience;
    cacheTtlMs;
    cachedKeys = new Map();
    lastFetchedAt = 0;
    /** Forced refreshes (unknown `kid`) happen at most once a minute — a stream of junk tokens must not become a stream of JWKS requests. */
    lastForcedAt = 0;
    constructor(options) {
        this.jwksUrl = options.jwksUrl;
        this.issuer = options.issuer;
        this.audience = options.audience;
        this.cacheTtlMs = options.cacheTtlMs ?? 30 * 60 * 1000;
    }
    async fetchJwks(force = false) {
        const now = Date.now();
        if (!force && this.cachedKeys.size > 0 && now - this.lastFetchedAt < this.cacheTtlMs) {
            return;
        }
        if (force) {
            if (now - this.lastForcedAt < FORCED_REFRESH_INTERVAL_MS)
                return;
            this.lastForcedAt = now;
        }
        const res = await fetch(this.jwksUrl, { signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
        if (!res.ok) {
            throw new Error(`Failed to fetch JWKS from ${this.jwksUrl}: HTTP ${res.status}`);
        }
        const data = (await res.json());
        const newMap = new Map();
        for (const key of data.keys) {
            if (key.kty === 'EC' && key.crv === 'P-256' && key.kid) {
                try {
                    const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
                    newMap.set(key.kid, cryptoKey);
                }
                catch {
                    // ignore unimportable key
                }
            }
        }
        this.cachedKeys = newMap;
        this.lastFetchedAt = now;
    }
    /**
     * Verifies the given token and returns its decoded claims.
     * Throws an Error if token is invalid, expired, or untrusted.
     */
    async verify(token, options) {
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
            throw new Error('Malformed JWT token structure');
        }
        const header = JSON.parse(base64UrlDecodeToString(parts[0]));
        const claims = JSON.parse(base64UrlDecodeToString(parts[1]));
        if (header.alg !== 'ES256') {
            throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
        }
        if (!header.kid) {
            throw new Error('JWT header missing "kid"');
        }
        // Try finding key in cache, otherwise refresh JWKS
        await this.fetchJwks(false);
        let key = this.cachedKeys.get(header.kid);
        if (!key) {
            await this.fetchJwks(true);
            key = this.cachedKeys.get(header.kid);
        }
        if (!key) {
            throw new Error(`Unknown signing key ID: ${header.kid}`);
        }
        // Verify ECDSA signature
        const signatureBytes = base64UrlDecodeToUint8Array(parts[2]);
        const messageBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const isValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signatureBytes, messageBytes);
        if (!isValid) {
            throw new Error('Invalid JWT signature');
        }
        // Validate claims
        const tolerance = options?.clockToleranceSeconds ?? 30;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (claims.iss !== this.issuer) {
            throw new Error(`Invalid issuer: expected ${this.issuer}, got ${claims.iss}`);
        }
        if (claims.aud !== this.audience) {
            throw new Error(`Invalid audience: expected ${this.audience}, got ${claims.aud}`);
        }
        // Only access tokens authorise requests; refresh proofs and impersonation tokens do not.
        if (claims.typ !== 'access') {
            throw new Error('not an access token');
        }
        // A token without an expiry never expires — refuse it rather than accept it forever.
        if (typeof claims.exp !== 'number' || claims.exp + tolerance < nowSeconds) {
            throw new Error('JWT token is expired');
        }
        if (claims.iat && claims.iat - tolerance > nowSeconds) {
            throw new Error('JWT token issued in the future');
        }
        if (options?.requiredScopes && options.requiredScopes.length > 0) {
            const granted = new Set(claims.scope ?? []);
            const missing = options.requiredScopes.filter((s) => !granted.has(s) && !granted.has('admin'));
            if (missing.length > 0) {
                throw new Error(`Missing required scopes: ${missing.join(', ')}`);
            }
        }
        return claims;
    }
}
//# sourceMappingURL=jwt-verifier.js.map