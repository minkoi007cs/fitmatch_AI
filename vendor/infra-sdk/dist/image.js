/**
 * Client-side image compression and resizing using HTML5 Canvas.
 * Zero external dependencies, safe fallback for server environments or unsupported formats.
 */
/**
 * Compresses and resizes an image Blob/File in the browser.
 * Returns the original Blob if executed in a non-browser environment or on non-image Blobs.
 */
export async function compressImage(file, options = {}) {
    // If not in browser environment (e.g. Node.js/SSR), return as-is
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return file;
    }
    // Only compress images
    if (!file.type || !file.type.startsWith('image/')) {
        return file;
    }
    // SVG, GIF (animated) should not be rasterized via canvas to preserve vector/animation
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return file;
    }
    const { maxWidth = 1920, maxHeight = 1920, quality = 0.85, format, } = options;
    const targetMime = format ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            // Scale dimensions preserving aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return resolve(file); // Fallback to original
            }
            // Fill white background for JPEG to handle PNG transparent areas cleanly
            if (targetMime === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    return resolve(file);
                }
                // If compressed blob is somehow bigger than original, keep original
                if (blob.size >= file.size && file.type === targetMime) {
                    return resolve(file);
                }
                resolve(blob);
            }, targetMime, quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fallback to original on decode error
        };
        img.src = url;
    });
}
//# sourceMappingURL=image.js.map