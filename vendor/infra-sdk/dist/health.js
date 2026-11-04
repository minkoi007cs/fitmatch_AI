import { request } from './http.js';
export function createHealthClient(options) {
    return {
        async check() {
            return request(options, {
                method: 'GET',
                path: '/api/v1/health',
                useApiKey: true,
            });
        },
        async overview() {
            return request(options, {
                method: 'GET',
                path: '/api/v1/monitoring/health',
                useApiKey: true,
            });
        },
    };
}
//# sourceMappingURL=health.js.map