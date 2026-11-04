import type { InfraClientOptions, Result } from './types.js';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export interface Workspace {
    id: string;
    appId: string;
    slug: string;
    name: string;
    createdBy: string;
    createdAt: string;
    role?: WorkspaceRole;
}
export interface WorkspaceMember {
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: WorkspaceRole;
    joinedAt: string;
}
export interface InfraWorkspacesClient {
    list(): Promise<Result<Workspace[]>>;
    get(id: string): Promise<Result<Workspace>>;
    create(input: {
        name: string;
        slug?: string;
    }): Promise<Result<Workspace>>;
    update(id: string, patch: {
        name?: string;
        slug?: string;
    }): Promise<Result<Workspace>>;
    delete(id: string): Promise<Result<{
        archived: boolean;
    }>>;
    listMembers(workspaceId: string): Promise<Result<WorkspaceMember[]>>;
    addMember(workspaceId: string, input: {
        userId: string;
        role?: WorkspaceRole;
    }): Promise<Result<{
        added: boolean;
        userId: string;
        role: WorkspaceRole;
    }>>;
    updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<Result<{
        updated: boolean;
        userId: string;
        role: WorkspaceRole;
    }>>;
    removeMember(workspaceId: string, userId: string): Promise<Result<{
        removed: boolean;
        userId: string;
    }>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createWorkspacesClient(options: InfraClientOptions, withAuth?: WithAuth): InfraWorkspacesClient;
export {};
//# sourceMappingURL=workspaces.d.ts.map