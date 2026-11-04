/**
 * Pages built on the hub with the visual editor (phase 4, rc.23), as a child app reads them.
 *
 * Both calls here take the PUBLISHABLE key and, optionally, the viewer's access token — and refuse
 * a secret key. That is the safety rail for data blocks: with `sk_` and no user token the hub treats
 * the caller as the app's own server, which row policies do not restrict, and a page shown to a
 * visitor would show every row. With `pk_` the hub answers as the viewer: their rows when a token
 * is sent, only the tables opened to visitors when not.
 */
import { fail, request } from './http.js';
function checkKey(key) {
    if (!key.startsWith('pk_')) {
        return fail('CONFIG_INVALID', 'pages and page data are read with the publishable key (pk_), never sk_ — see @infra/sdk pages.ts');
    }
    return null;
}
function headersFor(options) {
    return options.accessToken ? { 'x-infra-access-token': options.accessToken } : {};
}
/**
 * The published page at `path`. `data: null` when there is none (or only a draft).
 * An `UNAUTHENTICATED` error means the page is for signed-in users and nobody is signed in.
 */
export async function fetchPublishedPage(options) {
    const refused = checkKey(options.publishableKey);
    if (refused !== null)
        return refused;
    const result = await request({
        baseUrl: options.baseUrl,
        apiKey: options.publishableKey,
        headers: headersFor(options),
        credentials: 'omit',
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    }, { method: 'GET', path: `/api/v1/pages?path=${encodeURIComponent(options.path)}`, useApiKey: true });
    if (result.error !== null && result.error.code === 'APP_NOT_FOUND')
        return { data: null, error: null };
    return result;
}
/** One data-API read, as the viewer — what a page's data block runs. */
export async function queryAsViewer(options) {
    const refused = checkKey(options.publishableKey);
    if (refused !== null)
        return refused;
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(options.resource))
        return fail('VALIDATION_FAILED', 'invalid table name');
    return request({
        baseUrl: options.baseUrl,
        apiKey: options.publishableKey,
        headers: headersFor(options),
        credentials: 'omit',
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    }, { method: 'POST', path: `/api/v1/data/${options.resource}`, body: options.payload, useApiKey: true });
}
//# sourceMappingURL=pages.js.map