/**
 * File storage through the hub. The hub signs; the bytes go straight to the bucket.
 *
 *   const { data } = await client.storage.upload('avatars', file);   // → { id, … }
 *   const { data: link } = await client.storage.url(data.id);          // → { url, expiresAt }
 *
 * `upload` is three calls — ask for a URL, PUT the bytes, confirm — so a file only counts as
 * stored once the hub has seen it in the bucket with the size it was promised.
 */
import { fail, request } from './http.js';
export function createStorageClient(options, withAuth) {
    const call = (method, path, body) => withAuth((headers) => request({ ...options, headers: { ...(options.headers ?? {}), ...headers } }, {
        method,
        path,
        ...(body === undefined ? {} : { body }),
        useApiKey: true,
    }));
    const client = {
        createUpload: (bucket, input) => call('POST', '/api/v1/storage/upload', { bucket, ...input }),
        complete: (id) => call('POST', `/api/v1/storage/objects/${encodeURIComponent(id)}/complete`, {}),
        url: (id) => call('GET', `/api/v1/storage/objects/${encodeURIComponent(id)}/url`),
        remove: (id) => call('DELETE', `/api/v1/storage/objects/${encodeURIComponent(id)}`),
        list: (bucket, opts) => call('GET', `/api/v1/storage/objects?bucket=${encodeURIComponent(bucket)}&limit=${opts?.limit ?? 100}`),
        async upload(bucket, file, opts = {}) {
            const fileName = opts.fileName ?? file.name ?? 'file';
            const mimeType = opts.mimeType ?? (file.type !== '' ? file.type : 'application/octet-stream');
            const ticket = await client.createUpload(bucket, {
                fileName,
                mimeType,
                sizeBytes: file.size,
                ...(opts.ownerId === undefined ? {} : { ownerId: opts.ownerId }),
                ...(opts.workspaceId === undefined ? {} : { workspaceId: opts.workspaceId }),
                ...(opts.scope === undefined ? {} : { scope: opts.scope }),
            });
            if (ticket.error !== null)
                return ticket;
            // content-length is computed by the runtime from the body (browsers forbid setting it) and
            // matches the signed value because it is the same Blob whose size was requested.
            const doFetch = options.fetch ?? fetch;
            let put;
            try {
                put = await doFetch(ticket.data.upload.url, {
                    method: 'PUT',
                    headers: { 'content-type': ticket.data.upload.headers['content-type'] ?? mimeType },
                    body: file,
                });
            }
            catch {
                return fail('NETWORK_ERROR', 'could not reach file storage');
            }
            if (!put.ok)
                return fail('VALIDATION_FAILED', `storage refused the upload (HTTP ${put.status})`, 'unknown', put.status);
            return client.complete(ticket.data.objectId);
        },
        async replace(oldObjectId, bucket, file, opts = {}) {
            const result = await client.upload(bucket, file, opts);
            if (result.data && oldObjectId) {
                // Asynchronously delete old object
                try {
                    await client.remove(oldObjectId);
                }
                catch {
                    // Ignored
                }
            }
            return result;
        },
    };
    return client;
}
//# sourceMappingURL=storage.js.map