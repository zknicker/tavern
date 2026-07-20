const maxWikiImageBytes = 8 * 1024 * 1024;

export function validateWikiImageFile(file: Pick<File, 'size' | 'type'>) {
    if (file.size <= 0 || file.size > maxWikiImageBytes) {
        throw new Error('Wiki images must be between 1 byte and 8 MiB.');
    }
    if (
        file.type === 'image/gif' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp'
    ) {
        return file.type;
    }
    throw new Error('Paste or drop a PNG, JPEG, GIF, or WebP image.');
}
