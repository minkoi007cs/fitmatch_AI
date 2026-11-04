/**
 * User Secrets Vault SDK Client — secure per-user encrypted key-value storage.
 */
import { request } from './http.js';
export function createSecretsClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async list() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/me/secrets',
                useApiKey: true,
            }));
        },
        async get(key) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: `/api/v1/me/secrets/${encodeURIComponent(key)}`,
                useApiKey: true,
            }));
        },
        async set(key, value) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/me/secrets',
                body: { key, value },
                useApiKey: true,
            }));
        },
        async delete(key) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'DELETE',
                path: `/api/v1/me/secrets/${encodeURIComponent(key)}`,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=secrets.js.map