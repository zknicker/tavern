import { describe, expect, test } from 'bun:test';
import { agentFaceSlug, buildFaceSpriteCss, parseCanvasHeight } from './home-canvas.tsx';

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

describe('agentFaceSlug', () => {
    test('lowercases and slug-safes names', () => {
        expect(agentFaceSlug('Otto')).toBe('otto');
        expect(agentFaceSlug("  Wren's Twin ")).toBe('wren-s-twin');
    });
});

describe('buildFaceSpriteCss', () => {
    test('emits the base class plus one data-URI rule per sprite', () => {
        const css = buildFaceSpriteCss([
            { slug: 'otto', svg: '<svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>' },
        ]);

        expect(css).toContain('.tavern-face{');
        expect(css).toContain('.tavern-face[data-agent="otto"]');
        expect(css).toContain('url("data:image/svg+xml,');
        // The markup is URI-encoded so quotes and hashes stay CSS-safe.
        expect(css).not.toContain('viewBox="0');
    });

    test('returns nothing without sprites', () => {
        expect(buildFaceSpriteCss([])).toBe('');
    });
});
