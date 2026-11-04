/**
 * In-memory token bucket / sliding window rate limiter & header parsers.
 * Universal for Edge runtime, Cloudflare Workers, Next.js Middleware, and Express.
 */
export interface RateLimiterOptions {
    /** Maximum number of requests allowed within the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
    /** Optional cleanup interval for expired records (default: 60,000ms). */
    cleanupIntervalMs?: number | undefined;
}
export interface RateLimitResult {
    /** True if the request is within limits, false if throttled. */
    allowed: boolean;
    /** Remaining attempts allowed in current window. */
    remaining: number;
    /** Milliseconds until window resets. */
    resetMs: number;
    /** HTTP header dictionary ready to attach to response. */
    headers: Record<string, string>;
}
export interface RateLimiter {
    /** Check and consume 1 token for the specified key (e.g. client IP or User ID). */
    check: (key: string) => Promise<RateLimitResult>;
    /** Reset counter for a specific key. */
    reset: (key: string) => void;
    /** Clear all tracked keys. */
    clear: () => void;
}
/**
 * Creates an in-memory rate limiter with standard HTTP rate limit headers.
 */
export declare function createRateLimiter(options: RateLimiterOptions): RateLimiter;
/**
 * Extracts rate limit metrics from response headers.
 */
export declare function parseRateLimitHeaders(headers: Headers | Record<string, string | string[] | undefined>): {
    limit: number | null;
    remaining: number | null;
    reset: number | null;
};
//# sourceMappingURL=rate-limiter.d.ts.map