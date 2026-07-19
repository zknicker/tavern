import { describe, expect, test } from 'bun:test';
import { parseCanvasHeight } from './home-canvas.tsx';

describe('parseCanvasHeight', () => {
    test('reads the height meta tag', () => {
        expect(
            parseCanvasHeight('<head><meta name="tavern-canvas-height" content="320"></head>')
        ).toBe(320);
    });

    test('clamps to the allowed range', () => {
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="9999">')).toBe(720);
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="60">')).toBe(120);
    });

    test('defaults when the meta tag is absent or malformed', () => {
        expect(parseCanvasHeight('<html><body>hi</body></html>')).toBe(200);
        expect(parseCanvasHeight('<meta name="tavern-canvas-height" content="tall">')).toBe(200);
    });
});
