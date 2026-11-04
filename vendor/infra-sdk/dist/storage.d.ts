import type { InfraClientOptions, Result } from './types.js';
export interface StoredFile {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    ownerId?: string | null;
    workspaceId?: string | null;
    scope?: 'owner' | 'workspace' | 'public';
    createdAt?: string;
}
export interface UploadTicket {
    objectId: string;
    upload: {
        url: string;
        headers: Record<string, string>;
        expiresAt: string;
    };
}
export interface UploadOptions {
    /** Defaults to the File's name, or "file". */
    fileName?: string;
    /** Defaults to the Blob's type, or application/octet-stream. */
    mimeType?: string;
    /** Server + secret key only: upload on behalf of this user. */
    ownerId?: string;
    /** Optional workspace ID to attach the file to. */
    workspaceId?: string;
    /** File access scope: 'owner' (only uploader), 'workspace' (all workspace members), or 'public'. */
    scope?: 'owner' | 'workspace' | 'public';
}
type WithAuth = <T>(run: (headers: Record<string, string>) => Promise<Result<T>>) => Promise<Result<T>>;
export interface InfraStorageClient {
    createUpload(bucket: string, input: {
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        ownerId?: string;
        workspaceId?: string;
        scope?: 'owner' | 'workspace' | 'public';
    }): Promise<Result<UploadTicket>>;
    complete(objectId: string): Promise<Result<StoredFile>>;
    upload(bucket: string, file: Blob, options?: UploadOptions): Promise<Result<StoredFile>>;
    replace(oldObjectId: string, bucket: string, file: Blob, options?: UploadOptions): Promise<Result<StoredFile>>;
    url(objectId: string): Promise<Result<{
        url: string;
        expiresAt: string;
    }>>;
    remove(objectId: string): Promise<Result<{
        deleted: boolean;
    }>>;
    list(bucket: string, options?: {
        limit?: number;
    }): Promise<Result<StoredFile[]>>;
}
export declare function createStorageClient(options: InfraClientOptions, withAuth: WithAuth): InfraStorageClient;
export {};
//# sourceMappingURL=storage.d.ts.map