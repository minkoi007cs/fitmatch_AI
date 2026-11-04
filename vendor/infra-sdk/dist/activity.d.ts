import type { InfraClientOptions, Result } from './types.js';
export interface ActivityLog {
    id: string;
    appId: string;
    userId: string | null;
    workspaceId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    title: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}
export interface RecordActivityInput {
    entityType: string;
    entityId: string;
    action: string;
    title?: string;
    workspaceId?: string;
    metadata?: Record<string, unknown>;
}
export interface ListActivitiesInput {
    workspaceId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
}
export interface InfraActivityClient {
    log(input: RecordActivityInput): Promise<Result<ActivityLog>>;
    list(params?: ListActivitiesInput): Promise<Result<ActivityLog[]>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createActivityClient(options: InfraClientOptions, withAuth?: WithAuth): InfraActivityClient;
export {};
//# sourceMappingURL=activity.d.ts.map