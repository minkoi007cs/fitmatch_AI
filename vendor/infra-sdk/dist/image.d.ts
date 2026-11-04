/**
 * Client-side image compression and resizing using HTML5 Canvas.
 * Zero external dependencies, safe fallback for server environments or unsupported formats.
 */
export interface CompressImageOptions {
    /** Maximum width in pixels (aspect ratio is preserved). Defaults to 1920. */
    maxWidth?: number;
    /** Maximum height in pixels (aspect ratio is preserved). Defaults to 1920. */
    maxHeight?: number;
    /** Image quality from 0.1 to 1.0 (for jpeg/webp). Defaults to 0.85. */
    quality?: number;
    /** Target MIME format. Defaults to original format if supported, or image/jpeg. */
    format?: 'image/jpeg' | 'image/webp' | 'image/png';
}
/**
 * Compresses and resizes an image Blob/File in the browser.
 * Returns the original Blob if executed in a non-browser environment or on non-image Blobs.
 */
export declare function compressImage(file: Blob | File, options?: CompressImageOptions): Promise<Blob>;
//# sourceMappingURL=image.d.ts.map