import type { InfraClientOptions, Result } from './types.js';
export interface InfraSettingsClient {
    get<T = Record<string, unknown>>(): Promise<Result<T>>;
    update<T = Record<string, unknown>>(patch: Partial<T>): Promise<Result<T>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createSettingsClient(options: InfraClientOptions, withAuth?: WithAuth): InfraSettingsClient;
export {};
//# sourceMappingURL=settings.d.ts.map