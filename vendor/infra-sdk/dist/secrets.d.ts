import type { InfraClientOptions, Result } from './types.js';
export interface SecretKeyInfo {
    key: string;
    createdAt: string;
    updatedAt: string;
}
export interface InfraSecretsClient {
    list(): Promise<Result<SecretKeyInfo[]>>;
    get(key: string): Promise<Result<{
        key: string;
        value: string;
    }>>;
    set(key: string, value: string): Promise<Result<{
        saved: boolean;
        key: string;
    }>>;
    delete(key: string): Promise<Result<{
        deleted: boolean;
        key: string;
    }>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createSecretsClient(options: InfraClientOptions, withAuth?: WithAuth): InfraSecretsClient;
export {};
//# sourceMappingURL=secrets.d.ts.map