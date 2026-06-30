import { describe, expect, it } from 'bun:test';
import { getMentionAppearance, getMentionDisplayLabel } from './mention-appearance.tsx';

describe('mention appearance', () => {
    it('keeps generic skills on the default skill appearance', () => {
        expect(
            getMentionAppearance({
                id: '/Users/zknicker/.agents/skills/ui/SKILL.md',
                kind: 'skill',
                label: 'ui',
            })
        ).toEqual({
            icon: 'skill',
            tone: 'mention',
        });
    });

    it('resolves bundled GitHub skills to branded presentation', () => {
        const input = {
            id: '/Users/zknicker/.tavern/runtime/agent/skills/github/SKILL.md',
            kind: 'skill' as const,
            label: 'github',
        };

        expect(getMentionAppearance(input)).toEqual({
            brandColor: 'var(--foreground)',
            icon: 'github',
            label: 'GitHub',
            tone: 'brand',
        });
        expect(getMentionDisplayLabel(input)).toBe('GitHub');
    });

    it('resolves specialized GitHub workflow skills without changing their kind', () => {
        expect(
            getMentionAppearance({
                id: '/Users/zknicker/.tavern/runtime/agent/skills/gh-issues/SKILL.md',
                kind: 'skill',
                label: 'gh-issues',
            })
        ).toEqual({
            brandColor: 'var(--foreground)',
            icon: 'github',
            label: 'GitHub Issues',
            tone: 'brand',
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
            tone: 'mention',
        });
        expect(
            getMentionAppearance({
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app',
                label: 'Chrome',
            })
        ).toEqual({
            brandColor: 'var(--success-foreground)',
            icon: 'chrome',
            label: 'Chrome',
            tone: 'brand',
        });
        expect(
            getMentionDisplayLabel({
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app',
                label: 'Helium',
            })
        ).toBe('Helium');
    });

    it('uses native app icons when app metadata includes one', () => {
        expect(
            getMentionAppearance({
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app',
                label: 'Helium',
                metadata: {
                    iconDataUrl: 'data:image/png;base64,abc',
                },
            })
        ).toEqual({
            icon: 'plugin',
            iconDataUrl: 'data:image/png;base64,abc',
            tone: 'mention',
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
            tone: 'path',
        });
    });
});
