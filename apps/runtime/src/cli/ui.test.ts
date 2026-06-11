import { afterEach, describe, expect, test, vi } from 'vitest';
import { banner, colorEnabled, errorBlock, statusDot, ui } from './ui';

const fakeTty = { isTTY: true } as unknown as NodeJS.WriteStream;
const fakePipe = { isTTY: false } as unknown as NodeJS.WriteStream;

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('colorEnabled', () => {
    test('true for TTY without NO_COLOR', () => {
        vi.stubEnv('NO_COLOR', '');
        expect(colorEnabled(fakeTty)).toBe(true);
    });

    test('false for non-TTY', () => {
        expect(colorEnabled(fakePipe)).toBe(false);
    });

    test('false when NO_COLOR is set', () => {
        vi.stubEnv('NO_COLOR', '1');
        expect(colorEnabled(fakeTty)).toBe(false);
    });
});

describe('styling on non-TTY', () => {
    test('banner has no ANSI codes and is ≤ 6 lines', () => {
        const text = banner();
        expect(text).not.toMatch(/\[/);
        expect(text.split('\n').length).toBeLessThanOrEqual(6);
        expect(text).toContain('Tavern Runtime');
    });

    test('bold/dim are passthrough on a pipe', () => {
        expect(ui.bold('x', fakePipe)).toBe('x');
        expect(ui.dim('x', fakePipe)).toBe('x');
    });

    test('status dots use the right glyphs', () => {
        expect(statusDot('healthy', fakePipe)).toBe('●');
        expect(statusDot('degraded', fakePipe)).toBe('◐');
        expect(statusDot('off', fakePipe)).toBe('○');
    });

    test('error block renders message and hint', () => {
        const block = errorBlock('boom', 'try again');
        expect(block).toContain('✗ boom');
        expect(block).toContain('↳ try again');
    });
});

describe('styling on TTY', () => {
    test('accent wraps in ANSI when TTY and NO_COLOR unset', () => {
        vi.stubEnv('NO_COLOR', '');
        expect(ui.accent('x', fakeTty)).toMatch(/\[/);
    });
});
