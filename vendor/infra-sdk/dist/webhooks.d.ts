/**
 * Webhook signature verification and payload utilities for satellite apps.
 * Implemented using Web Crypto (SubtleCrypto) so it works across Node.js, Edge,
 * Cloudflare Workers, and Deno.
 */
export declare const DEFAULT_TOLERANCE_SECONDS = 300;
export interface WebhookEventPayload<T = Record<string, unknown>> {
    id: string;
    type: string;
    appId: string;
    createdAt: string;
    data: T;
}
export interface ParsedSignatureHeader {
    timestamp: number;
    signatures: string[];
}
export declare function parseSignatureHeader(header: string): ParsedSignatureHeader | null;
/**
 * Verifies an incoming webhook HMAC-SHA256 signature against the endpoint's secret (`whsec_...`).
 */
export declare function verifyWebhookSignature(secret: string, rawBody: string, signatureHeader: string, options?: {
    toleranceSeconds?: number;
    now?: number;
}): Promise<boolean>;
/**
 * Parses and verifies an incoming webhook request body.
 */
export declare function parseWebhookPayload<T = Record<string, unknown>>(rawBody: string): WebhookEventPayload<T>;
//# sourceMappingURL=webhooks.d.ts.map