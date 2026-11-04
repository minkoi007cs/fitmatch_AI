import { request } from './http.js';
export function createAuthClient(options) {
    return {
        signIn: {
            async email(input) {
                return request(options, {
                    method: 'POST',
                    path: '/api/auth/sign-in/email',
                    body: input,
                    useApiKey: false,
                });
            },
            async social(provider, opts = {}) {
                return request(options, {
                    method: 'POST',
                    path: '/api/auth/sign-in/social',
                    body: { provider, callbackURL: opts.callbackUrl ?? '/' },
                    useApiKey: false,
                });
            },
        },
        signUp: {
            async email(input) {
                return request(options, {
                    method: 'POST',
                    path: '/api/auth/sign-up/email',
                    body: input,
                    useApiKey: false,
                });
            },
        },
        async signOut() {
            return request(options, { method: 'POST', path: '/api/auth/sign-out', useApiKey: false });
        },
        async getSession() {
            return request(options, { method: 'GET', path: '/api/v1/me', useApiKey: true });
        },
    };
}
//# sourceMappingURL=auth.js.map