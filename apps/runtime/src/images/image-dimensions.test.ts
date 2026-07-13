import { describe, expect, test } from 'vitest';
import { parseImageDimensions } from './image-dimensions.ts';

describe('parseImageDimensions', () => {
    test('reads PNG dimensions', () => {
        const bytes = new Uint8Array(24);
        bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        bytes.set([0x49, 0x48, 0x44, 0x52], 12);
        new DataView(bytes.buffer).setUint32(16, 640);
        new DataView(bytes.buffer).setUint32(20, 480);

        expect(parseImageDimensions(bytes)).toEqual({ height: 480, width: 640 });
    });

    test.each([0xc0, 0xc1, 0xc2])('reads JPEG SOF marker %#', (marker) => {
        const bytes = Uint8Array.from([
            0xff,
            0xd8,
            0xff,
            0xe0,
            0x00,
            0x02,
            0xff,
            marker,
            0x00,
            0x07,
            0x08,
            0x01,
            0x2c,
            0x02,
            0x58,
        ]);

        expect(parseImageDimensions(bytes)).toEqual({ height: 300, width: 600 });
    });

    test('reads WebP VP8X dimensions', () => {
        const payload = new Uint8Array(10);
        writeUint24Le(payload, 4, 799);
        writeUint24Le(payload, 7, 599);

        expect(parseImageDimensions(webp('VP8X', payload))).toEqual({
            height: 600,
            width: 800,
        });
    });

    test('reads WebP VP8L dimensions', () => {
        const width = 320;
        const height = 240;
        const widthMinusOne = width - 1;
        const heightMinusOne = height - 1;
        const payload = Uint8Array.from([
            0x2f,
            widthMinusOne & 0xff,
            ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6),
            (heightMinusOne >> 2) & 0xff,
            (heightMinusOne >> 10) & 0x0f,
        ]);

        expect(parseImageDimensions(webp('VP8L', payload))).toEqual({ height, width });
    });

    test('reads WebP VP8 dimensions', () => {
        const payload = Uint8Array.from([
            0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x80, 0x02, 0xe0, 0x01,
        ]);

        expect(parseImageDimensions(webp('VP8 ', payload))).toEqual({
            height: 480,
            width: 640,
        });
    });

    test('returns null for an unknown format', () => {
        expect(parseImageDimensions(Uint8Array.from([1, 2, 3, 4]))).toBeNull();
    });
});

function webp(type: string, payload: Uint8Array) {
    const padding = payload.length % 2;
    const bytes = new Uint8Array(20 + payload.length + padding);
    const view = new DataView(bytes.buffer);
    bytes.set(Buffer.from('RIFF'), 0);
    view.setUint32(4, bytes.length - 8, true);
    bytes.set(Buffer.from('WEBP'), 8);
    bytes.set(Buffer.from(type), 12);
    view.setUint32(16, payload.length, true);
    bytes.set(payload, 20);
    return bytes;
}

function writeUint24Le(bytes: Uint8Array, offset: number, value: number) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
}
