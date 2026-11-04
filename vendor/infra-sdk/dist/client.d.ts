import type { InfraClient, InfraClientOptions } from './types.js';
/**
 * Entry point for child applications.
 *
 *   const infra = createInfraClient({ baseUrl, apiKey });
 *   const { data, error } = await infra.db.query('select 1');
 *
 * Throws only for a misconfigured client — every runtime failure is returned as
 * `{ data: null, error }` instead.
 */
export declare function createInfraClient(options: InfraClientOptions): InfraClient;
//# sourceMappingURL=client.d.ts.map