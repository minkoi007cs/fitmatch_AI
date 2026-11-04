import type { InfraClientOptions, InfraErrorCode, Result } from './types.js';
export declare const DEFAULT_TIMEOUT_MS = 15000;
export declare function ok<T>(data: T): Result<T>;
export declare function fail<T>(code: InfraErrorCode, message: string, requestId?: string, httpStatus?: number): Result<T>;
export interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    /** Auth endpoints ride on cookies; data endpoints ride on the API key. */
    useApiKey: boolean;
}
export declare function normaliseBaseUrl(baseUrl: string): string;
/**
 * Single exit point for every network call. Never throws for a business failure —
 * transport problems become NETWORK_ERROR results.
 */
export declare function request<T>(options: InfraClientOptions, req: RequestOptions): Promise<Result<T>>;
//# sourceMappingURL=http.d.ts.map