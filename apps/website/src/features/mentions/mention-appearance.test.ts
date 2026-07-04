import { describe, expect, it } from 'bun:test';
import { getMentionAppearance, getMentionDisplayLabel } from './mention-appearance.tsx';

describe('mention appearance', () => {
    it('keeps generic skills on the default skill appearance', () => {
        expect(
            getMentionAppearance({
                id: 'skill://ui',
                kind: 'skill',
                label: 'ui',
            })
        ).toEqual({
            brandColor: 'var(--brand)',
            icon: 'skill',
        });
    });

    it('resolves bundled GitHub skills to branded presentation', () => {
        const input = {
            id: 'skill://github',
            kind: 'skill' as const,
            label: 'github',
        };

        expect(getMentionAppearance(input)).toEqual({
            brandColor: 'var(--foreground)',
            icon: 'github',
            label: 'GitHub',
        });
        expect(getMentionDisplayLabel(input)).toBe('GitHub');
    });

    it('resolves specialized GitHub workflow skills without changing their kind', () => {
        expect(
            getMentionAppearance({
                id: 'skill://gh-issues',
                kind: 'skill',
                label: 'gh-issues',
            })
        ).toEqual({
            brandColor: 'var(--foreground)',
            icon: 'github',
            label: 'GitHub Issues',
        });
    });

    it('resolves bundled Codex plugin and Computer Use app targets', () => {
        expect(
            getMentionAppearance({
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin',
                label: 'Computer Use',
            })
        ).toEqual({
            icon: 'plugin',
            label: 'Computer Use',
        });
        expect(
            getMentionAppearance({
                id: 'app://computer-use/com.google.Chrome',
                kind: 'app',
                label: 'Chrome',
            })
        ).toEqual({
            brandColor: 'var(--success-foreground)',
            icon: 'chrome',
            label: 'Chrome',
        });
        expect(
            getMentionDisplayLabel({
                id: 'app://computer-use/net.imput.helium',
                kind: 'app',
                label: 'Helium',
            })
        ).toBe('Helium');
    });

    it('uses native app icons when app metadata includes one', () => {
        expect(
            getMentionAppearance({
                id: 'app://computer-use/net.imput.helium',
                kind: 'app',
                label: 'Helium',
                metadata: {
                    iconDataUrl: 'data:image/png;base64,abc',
                },
            })
        ).toEqual({
            icon: 'plugin',
            iconDataUrl: 'data:image/png;base64,abc',
        });
    });

    it('keeps path mentions consistent', () => {
        expect(
            getMentionAppearance({
                id: '/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md',
                kind: 'file',
                label: 'mentions.md',
            })
        ).toEqual({
            icon: 'file',
        });
    });
});
