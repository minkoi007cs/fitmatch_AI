/**
 * Sub-app Activity & Audit Feed SDK Client.
 */
import { request } from './http.js';
export function createActivityClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async log(input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/activity',
                body: input,
                useApiKey: true,
            }));
        },
        async list(params) {
            const query = new URLSearchParams();
            if (params?.workspaceId)
                query.set('workspaceId', params.workspaceId);
            if (params?.entityType)
                query.set('entityType', params.entityType);
            if (params?.entityId)
                query.set('entityId', params.entityId);
            if (params?.limit)
                query.set('limit', String(params.limit));
            const qs = query.toString();
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: `/api/v1/activity${qs ? `?${qs}` : ''}`,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=activity.js.map