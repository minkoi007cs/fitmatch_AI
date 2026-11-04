/**
 * Invitations SDK Client.
 */
import { request } from './http.js';
export function createInvitationsClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async list() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/invitations',
                useApiKey: true,
            }));
        },
        async invite(input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/invitations',
                body: input,
                useApiKey: true,
            }));
        },
        async accept(token) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/invitations/accept',
                body: { token },
                useApiKey: true,
            }));
        },
        async revoke(id) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'DELETE',
                path: `/api/v1/invitations/${encodeURIComponent(id)}`,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=invitations.js.map