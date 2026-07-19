import { describe, expect, test } from 'bun:test';
import { agentFaceAliases, buildFaceSpriteCss, parseCanvasHeight } from './home-canvas.tsx';

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

describe('agentFaceAliases', () => {
    test('covers exact, slug, and collapsed forms', () => {
        expect(agentFaceAliases('Otto')).toEqual(['otto']);
        expect(agentFaceAliases("  Wren's  Twin ")).toEqual([
            "wren's twin",
            'wren-s-twin',
            'wrenstwin',
        ]);
    });
});

describe('buildFaceSpriteCss', () => {
    test('emits a case-insensitive, fully-styled rule per alias', () => {
        const css = buildFaceSpriteCss([
            {
                aliases: agentFaceAliases("Wren's Twin"),
                svg: '<svg viewBox="0 0 8 8"><path d="M0 0h8"/></svg>',
            },
        ]);

        expect(css).toContain('.tavern-face[data-agent="wren\'s twin" i]');
        expect(css).toContain('.tavern-face[data-agent="wren-s-twin" i]');
        expect(css).toContain('.tavern-face[data-agent="wrenstwin" i]');
        // Every rule carries its own sizing, so unknown agents collapse to
        // nothing instead of an empty gap.
        expect(css).not.toContain('.tavern-face{');
        expect(css).toContain('display:inline-block;width:1.15em');
        expect(css).toContain('url("data:image/svg+xml,');
        // The markup is URI-encoded so quotes and hashes stay CSS-safe.
        expect(css).not.toContain('viewBox="0');
    });

    test('returns nothing without sprites', () => {
        expect(buildFaceSpriteCss([])).toBe('');
    });
});
