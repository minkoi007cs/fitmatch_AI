import type { Result } from './types.js';
export interface PageRequestOptions {
    /** The hub, e.g. https://system.minkoi.org */
    baseUrl: string;
    /** pk_… — a secret key is refused. */
    publishableKey: string;
    /** The signed-in viewer's access token, or null for a visitor. */
    accessToken?: string | null;
    /** e.g. a fetch that adds Next's `{ next: { revalidate: 30 } }`. */
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
}
export interface PublishedPage {
    /** rc.34+. Absent from older hubs. */
    pageId?: string;
    path: string;
    title: string;
    visibility: 'public' | 'signed_in';
    version: number;
    publishedAt: string;
    layout: {
        root: Record<string, unknown>;
        content: unknown[];
        zones?: Record<string, unknown[]>;
    };
    /** rc.34+: one time token per Form block — pass to attachFormRuntime (@infra/puck-config). */
    forms?: Array<{
        blockId: string;
        token: string;
    }>;
}
/**
 * The published page at `path`. `data: null` when there is none (or only a draft).
 * An `UNAUTHENTICATED` error means the page is for signed-in users and nobody is signed in.
 */
export declare function fetchPublishedPage(options: PageRequestOptions & {
    path: string;
}): Promise<Result<PublishedPage | null>>;
/** One data-API read, as the viewer — what a page's data block runs. */
export declare function queryAsViewer(options: PageRequestOptions & {
    resource: string;
    payload: Record<string, unknown>;
}): Promise<Result<{
    rows: Array<Record<string, unknown>>;
}>>;
//# sourceMappingURL=pages.d.ts.map