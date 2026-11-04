import { request } from './http.js';
export function createDbClient(options) {
    return {
        async query(sql, params = []) {
            return request(options, {
                method: 'POST',
                path: '/api/v1/query',
                body: { sql, params },
                useApiKey: true,
            });
        },
        async queryOne(sql, params = []) {
            const result = await request(options, {
                method: 'POST',
                path: '/api/v1/query',
                body: { sql, params },
                useApiKey: true,
            });
            if (result.error !== null)
                return { data: null, error: result.error };
            return { data: result.data[0] ?? null, error: null };
        },
        async health() {
            return request(options, { method: 'GET', path: '/api/v1/health', useApiKey: true });
        },
    };
}
//# sourceMappingURL=db.js.map