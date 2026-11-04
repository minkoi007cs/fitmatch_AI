import type { InfraClientOptions, Result } from './types.js';
export interface InboxNotification {
    id: string;
    appId: string;
    userId: string;
    title: string;
    body: string;
    category: string;
    actionUrl: string | null;
    metadata: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
}
export interface CreateNotificationInput {
    userId?: string;
    title: string;
    body: string;
    category?: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
}
export interface InfraNotificationsClient {
    list(params?: {
        unreadOnly?: boolean;
        limit?: number;
    }): Promise<Result<InboxNotification[]>>;
    notify(input: CreateNotificationInput): Promise<Result<InboxNotification>>;
    markAsRead(id: string): Promise<Result<{
        read: boolean;
        id: string;
    }>>;
    markAllAsRead(): Promise<Result<{
        read: boolean;
        count: number;
    }>>;
    getUnreadCount(): Promise<Result<{
        unreadCount: number;
    }>>;
    delete(id: string): Promise<Result<{
        deleted: boolean;
        id: string;
    }>>;
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export declare function createNotificationsClient(options: InfraClientOptions, withAuth?: WithAuth): InfraNotificationsClient;
export {};
//# sourceMappingURL=notifications.d.ts.map