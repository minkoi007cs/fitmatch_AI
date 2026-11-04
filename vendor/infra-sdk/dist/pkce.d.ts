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
export interface PkcePair {
    /** Keep secret, keep server-side; present it once, at exchange. */
    verifier: string;
    /** base64url(SHA-256(verifier)) — the only form the hub ever sees before the exchange. */
    challenge: string;
}
export interface AuthorizeRequest {
    /** Send the browser here. */
    url: string;
    /** Store (httpOnly cookie) and compare on the callback. */
    state: string;
    /** Store (httpOnly cookie) and present at exchange. */
    codeVerifier: string;
}
export interface AuthorizeOptions {
    /** The hub, e.g. https://system.minkoi.org */
    baseUrl: string;
    /** The app's publishable key — public by design, it identifies the app. */
    clientId: string;
    /** Must be on an origin registered for the app, or the hub refuses to redirect there. */
    redirectUri: string;
    /** Pre-select a provider and skip the choice screen. */
    provider?: 'google' | 'github' | 'microsoft';
}
export declare function base64UrlEncode(bytes: Uint8Array): string;
export declare function randomToken(byteLength?: number): string;
export declare function challengeFor(verifier: string): Promise<string>;
export declare function createPkcePair(): Promise<PkcePair>;
export declare function createAuthorizeRequest(options: AuthorizeOptions): Promise<AuthorizeRequest>;
//# sourceMappingURL=pkce.d.ts.map