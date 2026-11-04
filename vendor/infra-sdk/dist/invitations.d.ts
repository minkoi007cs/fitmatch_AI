import type { InfraClientOptions, Result } from './types.js';
export interface AppInvitation {
    id: string;
    appId: string;
    email: string;
    role: string;
    invitedBy: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
}
export interface InviteUserInput {
    email: string;
    role?: string;
    sendEmail?: boolean;
    inviteUrlTemplate?: string;
}
export interface IssuedInvitationResult {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    token: string;
}
export interface InfraInvitationsClient {
    list(): Promise<Result<AppInvitation[]>>;
    invite(input: InviteUserInput): Promise<Result<IssuedInvitationResult>>;
    accept(token: string): Promise<Result<{
        accepted: boolean;
        appId: string;
        role: string;
    }>>;
    revoke(id: string): Promise<Result<{
        revoked: boolean;
        id: string;
    }>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createInvitationsClient(options: InfraClientOptions, withAuth?: WithAuth): InfraInvitationsClient;
export {};
//# sourceMappingURL=invitations.d.ts.map