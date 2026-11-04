/**
 * User Settings & Preferences SDK Client.
 */
import { request } from './http.js';
export function createSettingsClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async get() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/me/settings',
                useApiKey: true,
            }));
        },
        async update(patch) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'PATCH',
                path: '/api/v1/me/settings',
                body: patch,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=settings.js.map