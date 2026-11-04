/**
 * In-memory token bucket / sliding window rate limiter & header parsers.
 * Universal for Edge runtime, Cloudflare Workers, Next.js Middleware, and Express.
 */
/**
 * Creates an in-memory rate limiter with standard HTTP rate limit headers.
 */
export function createRateLimiter(options) {
    const { limit, windowMs, cleanupIntervalMs = 60_000 } = options;
    const store = new Map();
    // Cleanup timer if supported in the runtime
    if (typeof setInterval === 'function') {
        const timer = setInterval(() => {
            const now = Date.now();
            for (const [key, record] of store.entries()) {
                if (record.resetAt <= now) {
                    store.delete(key);
                }
            }
        }, cleanupIntervalMs);
        // Unref timer on Node.js to avoid blocking exit
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
        }
    }
    return {
        async check(key) {
            const now = Date.now();
            let record = store.get(key);
            if (!record || record.resetAt <= now) {
                record = {
                    count: 1,
                    resetAt: now + windowMs,
                };
                store.set(key, record);
            }
            else {
                record.count += 1;
            }
            const allowed = record.count <= limit;
            const remaining = Math.max(0, limit - record.count);
            const resetMs = Math.max(0, record.resetAt - now);
            const resetSeconds = Math.ceil(resetMs / 1000);
            const headers = {
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
            };
            if (!allowed) {
                headers['Retry-After'] = String(resetSeconds);
            }
            return {
                allowed,
                remaining,
                resetMs,
                headers,
            };
        },
        reset(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
    };
}
/**
 * Extracts rate limit metrics from response headers.
 */
export function parseRateLimitHeaders(headers) {
    const getHeader = (name) => {
        if (typeof headers.get === 'function') {
            return headers.get(name);
        }
        const record = headers;
        const val = record[name] ?? record[name.toLowerCase()];
        return Array.isArray(val) ? (val[0] ?? null) : (val ?? null);
    };
    const limitRaw = getHeader('x-ratelimit-limit');
    const remainingRaw = getHeader('x-ratelimit-remaining');
    const resetRaw = getHeader('x-ratelimit-reset');
    return {
        limit: limitRaw ? Number.parseInt(limitRaw, 10) : null,
        remaining: remainingRaw ? Number.parseInt(remainingRaw, 10) : null,
        reset: resetRaw ? Number.parseInt(resetRaw, 10) : null,
    };
}
//# sourceMappingURL=rate-limiter.js.map