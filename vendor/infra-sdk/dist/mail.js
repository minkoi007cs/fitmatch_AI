/**
 * Mail SDK Client — for sending transactional email via the Hub (server-only with sk_ key).
 */
import { request } from './http.js';
export function createMailClient(options) {
    return {
        async send(input) {
            return request(options, {
                method: 'POST',
                path: '/api/v1/mail/send',
                body: input,
                useApiKey: true,
            });
        },
    };
}
//# sourceMappingURL=mail.js.map