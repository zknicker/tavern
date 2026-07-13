export interface ImageDimensions {
    height: number;
    width: number;
}

export function parseImageDimensions(bytes: Uint8Array): ImageDimensions | null {
    return parsePngDimensions(bytes) ?? parseJpegDimensions(bytes) ?? parseWebpDimensions(bytes);
}

function parsePngDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (
        bytes.length < 24 ||
        !matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
        !matches(bytes, 12, [0x49, 0x48, 0x44, 0x52])
    ) {
        return null;
    }

    return validDimensions(readUint32Be(bytes, 16), readUint32Be(bytes, 20));
}

function parseJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (!matches(bytes, 0, [0xff, 0xd8])) {
        return null;
    }

    let offset = 2;
    while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        while (bytes[offset] === 0xff) {
            offset += 1;
        }
        const marker = bytes[offset];
        offset += 1;
        if (marker === undefined || marker === 0xd9 || marker === 0xda) {
            return null;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            continue;
        }
        if (offset + 1 >= bytes.length) {
            return null;
        }

        const segmentLength = readUint16Be(bytes, offset);
        if (segmentLength < 2 || offset + segmentLength > bytes.length) {
            return null;
        }
        if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && segmentLength >= 7) {
            return validDimensions(
                readUint16Be(bytes, offset + 5),
                readUint16Be(bytes, offset + 3)
            );
        }
        offset += segmentLength;
    }

    return null;
}

function parseWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }

    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const chunkSize = readUint32Le(bytes, offset + 4);
        const dataOffset = offset + 8;
        if (dataOffset + chunkSize > bytes.length) {
            return null;
        }

        const chunkType = ascii(bytes, offset, 4);
        const dimensions = parseWebpChunk(bytes, chunkType, dataOffset, chunkSize);
        if (dimensions) {
            return dimensions;
        }
        offset = dataOffset + chunkSize + (chunkSize % 2);
    }

    return null;
}

function parseWebpChunk(
    bytes: Uint8Array,
    chunkType: string,
    offset: number,
    size: number
): ImageDimensions | null {
    if (chunkType === 'VP8X' && size >= 10) {
        return validDimensions(
            readUint24Le(bytes, offset + 4) + 1,
            readUint24Le(bytes, offset + 7) + 1
        );
    }
    if (chunkType === 'VP8L' && size >= 5 && bytes[offset] === 0x2f) {
        const byte1 = bytes[offset + 1] ?? 0;
        const byte2 = bytes[offset + 2] ?? 0;
        const byte3 = bytes[offset + 3] ?? 0;
        const byte4 = bytes[offset + 4] ?? 0;
        return validDimensions(
            1 + byte1 + ((byte2 & 0x3f) << 8),
            1 + ((byte2 & 0xc0) >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10)
        );
    }
    if (chunkType === 'VP8 ' && size >= 10 && matches(bytes, offset + 3, [0x9d, 0x01, 0x2a])) {
        return validDimensions(
            readUint16Le(bytes, offset + 6) & 0x3f_ff,
            readUint16Le(bytes, offset + 8) & 0x3f_ff
        );
    }
    return null;
}

function validDimensions(width: number, height: number): ImageDimensions | null {
    return width > 0 && height > 0 ? { height, width } : null;
}

function matches(bytes: Uint8Array, offset: number, expected: number[]) {
    return expected.every((value, index) => bytes[offset + index] === value);
}

function matchesAscii(bytes: Uint8Array, offset: number, expected: string) {
    return ascii(bytes, offset, expected.length) === expected;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint16Be(bytes: Uint8Array, offset: number) {
    return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint16Le(bytes: Uint8Array, offset: number) {
    return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint24Le(bytes: Uint8Array, offset: number) {
    return (
        (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)
    );
}

function readUint32Be(bytes: Uint8Array, offset: number) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function readUint32Le(bytes: Uint8Array, offset: number) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
