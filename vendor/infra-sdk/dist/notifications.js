/**
 * In-app Notifications (Inbox) SDK Client.
 */
import { request } from './http.js';
export function createNotificationsClient(options, withAuth) {
    const call = async (runner) => {
        if (withAuth)
            return withAuth(runner);
        return runner({});
    };
    return {
        async list(params) {
            const query = new URLSearchParams();
            if (params?.unreadOnly)
                query.set('unread', 'true');
            if (params?.limit)
                query.set('limit', String(params.limit));
            const qs = query.toString();
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: `/api/v1/inbox${qs ? `?${qs}` : ''}`,
                useApiKey: true,
            }));
        },
        async notify(input) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/inbox',
                body: input,
                useApiKey: true,
            }));
        },
        async markAsRead(id) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/inbox/read',
                body: { id },
                useApiKey: true,
            }));
        },
        async markAllAsRead() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'POST',
                path: '/api/v1/inbox/read',
                body: { all: true },
                useApiKey: true,
            }));
        },
        async getUnreadCount() {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'GET',
                path: '/api/v1/inbox/unread-count',
                useApiKey: true,
            }));
        },
        async delete(id) {
            return call(async (headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
                method: 'DELETE',
                path: `/api/v1/inbox/${encodeURIComponent(id)}`,
                useApiKey: true,
            }));
        },
    };
}
//# sourceMappingURL=notifications.js.map