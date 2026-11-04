import type { InfraClientOptions, Result, HealthReport } from './types.js';
export interface SystemHealthOverview {
    status: 'healthy' | 'degraded' | 'down';
    uptimeSeconds: number;
    timestamp: string;
    version: string;
    checks: {
        database: {
            status: 'healthy' | 'degraded' | 'down';
            latencyMs: number | null;
        };
        storage?: {
            status: 'healthy' | 'degraded' | 'down';
        } | undefined;
        aiGateway?: {
            status: 'healthy' | 'degraded' | 'down';
        } | undefined;
    };
}
export interface InfraHealthClient {
    /** Check calling app's tenant database health */
    check: () => Promise<Result<HealthReport>>;
    /** Get overview of Hub system health */
    overview: () => Promise<Result<SystemHealthOverview>>;
}
export declare function createHealthClient(options: InfraClientOptions): InfraHealthClient;
//# sourceMappingURL=health.d.ts.map