/**
 * Hosted sign-in for child apps — the pieces a child app needs to send a person to the hub and
 * take them back signed in.
 *
 * Why a redirect, and not a sign-in form inside each child app: the hub is where the Google,
 * GitHub and Microsoft credentials live, and those providers only ever call back to the hub. A
 * child app cannot run the social flow itself without its own OAuth registration at every
 * provider. So the child app sends the person to one page on the hub, the hub does whichever
 * sign-in they choose, and hands back a one-time code that only this child app's server can
 * exchange.
 *
 * It is OAuth 2's authorization-code flow with PKCE (RFC 7636), and each piece has a job:
 *
 *   state          ties the answer to the request this browser started — a callback carrying a
 *                  state this browser never issued is someone else's login being replayed at you.
 *   code_verifier  a secret generated here and never sent until the exchange. The hub only ever
 *                  sees its hash. A code intercepted on the way back is useless without it.
 *   the sk_ key    the exchange requires the app's secret key, so the code is redeemable only by
 *                  this app's server, never by a browser and never by another app.
 *
 * Uses WebCrypto only, so it runs in Node 20+, edge runtimes and browsers alike.
 */
function webCrypto() {
    const c = globalThis.crypto;
    if (c === undefined || c.subtle === undefined) {
        throw new Error('[@infra/sdk] WebCrypto is not available in this runtime (need Node 20+)');
    }
    return c;
}
export function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomToken(byteLength = 32) {
    const bytes = new Uint8Array(byteLength);
    webCrypto().getRandomValues(bytes);
    return base64UrlEncode(bytes);
}
export async function challengeFor(verifier) {
    const digest = await webCrypto().subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64UrlEncode(new Uint8Array(digest));
}
export async function createPkcePair() {
    // 32 random bytes → 43 base64url characters: the minimum length RFC 7636 allows, and plenty.
    const verifier = randomToken(32);
    return { verifier, challenge: await challengeFor(verifier) };
}
export async function createAuthorizeRequest(options) {
    const { verifier, challenge } = await createPkcePair();
    const state = randomToken(24);
    const url = new URL('/authorize', options.baseUrl.replace(/\/+$/, '') + '/');
    url.searchParams.set('client_id', options.clientId);
    url.searchParams.set('redirect_uri', options.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (options.provider !== undefined)
        url.searchParams.set('provider', options.provider);
    return { url: url.toString(), state, codeVerifier: verifier };
}
//# sourceMappingURL=pkce.js.map