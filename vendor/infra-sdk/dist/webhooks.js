/**
 * Webhook signature verification and payload utilities for satellite apps.
 * Implemented using Web Crypto (SubtleCrypto) so it works across Node.js, Edge,
 * Cloudflare Workers, and Deno.
 */
export const DEFAULT_TOLERANCE_SECONDS = 300;
export function parseSignatureHeader(header) {
    let timestamp = null;
    const signatures = [];
    for (const segment of header.split(',')) {
        const [key, value] = segment.trim().split('=');
        if (!key || !value)
            continue;
        if (key === 't') {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed))
                timestamp = parsed;
        }
        else if (key === 'v1') {
            signatures.push(value);
        }
    }
    if (timestamp === null || signatures.length === 0)
        return null;
    return { timestamp, signatures };
}
function hexToUint8Array(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return result === 0;
}
/**
 * Verifies an incoming webhook HMAC-SHA256 signature against the endpoint's secret (`whsec_...`).
 */
export async function verifyWebhookSignature(secret, rawBody, signatureHeader, options) {
    const parts = parseSignatureHeader(signatureHeader);
    if (!parts)
        return false;
    const now = options?.now ?? Math.floor(Date.now() / 1000);
    const tolerance = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
    if (Math.abs(now - parts.timestamp) > tolerance) {
        return false;
    }
    const payloadToSign = `${parts.timestamp}.${rawBody}`;
    const enc = new TextEncoder();
    try {
        const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const expectedSigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payloadToSign));
        const expectedSigBytes = new Uint8Array(expectedSigBuffer);
        return parts.signatures.some((sigHex) => {
            if (sigHex.length !== expectedSigBytes.length * 2)
                return false;
            const candidateBytes = hexToUint8Array(sigHex);
            return constantTimeEqual(candidateBytes, expectedSigBytes);
        });
    }
    catch {
        return false;
    }
}
/**
 * Parses and verifies an incoming webhook request body.
 */
export function parseWebhookPayload(rawBody) {
    return JSON.parse(rawBody);
}
//# sourceMappingURL=webhooks.js.map