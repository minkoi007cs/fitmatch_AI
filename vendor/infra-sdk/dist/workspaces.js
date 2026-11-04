/**
 * Workspaces SDK Client for team/workspace multi-tenancy.
 */
import { request } from './http.js';
export function createWorkspacesClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async list() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/workspaces',
                useApiKey: true,
            }));
        },
        async get(id) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: `/api/v1/workspaces/${encodeURIComponent(id)}`,
                useApiKey: true,
            }));
        },
        async create(input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/workspaces',
                body: input,
                useApiKey: true,
            }));
        },
        async update(id, patch) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'PATCH',
                path: `/api/v1/workspaces/${encodeURIComponent(id)}`,
                body: patch,
                useApiKey: true,
            }));
        },
        async delete(id) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'DELETE',
                path: `/api/v1/workspaces/${encodeURIComponent(id)}`,
                useApiKey: true,
            }));
        },
        async listMembers(workspaceId) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
                useApiKey: true,
            }));
        },
        async addMember(workspaceId, input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
                body: input,
                useApiKey: true,
            }));
        },
        async updateMemberRole(workspaceId, userId, role) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'PATCH',
                path: `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
                body: { role },
                useApiKey: true,
            }));
        },
        async removeMember(workspaceId, userId) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'DELETE',
                path: `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=workspaces.js.map