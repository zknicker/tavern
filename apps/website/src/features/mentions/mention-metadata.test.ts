import { describe, expect, it } from 'bun:test';
import { readMentionsFromMetadata } from './mention-metadata.ts';

describe('readMentionsFromMetadata', () => {
    it('reads stored Tavern mentions', () => {
        const content = 'Use [$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)';

        expect(
            readMentionsFromMetadata(content, {
                tavern: {
                    mentions: [
                        {
                            end: content.length,
                            id: '/Users/zknicker/.agents/skills/ui/SKILL.md',
                            kind: 'skill',
                            label: 'ui',
                            projection: 'skill-context',
                            start: 4,
                            text: '[$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
                        },
                    ],
                },
            })
        ).toEqual([
            {
                end: content.length,
                id: '/Users/zknicker/.agents/skills/ui/SKILL.md',
                kind: 'skill',
                label: 'ui',
                projection: 'skill-context',
                start: 4,
                text: '[$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
            },
        ]);
    });

    it('preserves stored mention metadata for app icons', () => {
        const content = 'Open [@Messages](plugin://computer-use@openai-bundled)';

        expect(
            readMentionsFromMetadata(content, {
                tavern: {
                    mentions: [
                        {
                            end: content.length,
                            id: 'plugin://computer-use@openai-bundled',
                            kind: 'app',
                            label: 'Messages',
                            metadata: {
                                bundleId: 'com.apple.MobileSMS',
                                iconDataUrl: 'data:image/png;base64,abc',
                            },
                            projection: 'capability-reference',
                            start: 5,
                            text: '[@Messages](plugin://computer-use@openai-bundled)',
                        },
                    ],
                },
            })
        ).toEqual([
            {
                end: content.length,
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app',
                label: 'Messages',
                metadata: {
                    bundleId: 'com.apple.MobileSMS',
                    iconDataUrl: 'data:image/png;base64,abc',
                },
                projection: 'capability-reference',
                start: 5,
                text: '[@Messages](plugin://computer-use@openai-bundled)',
            },
        ]);
    });

    it('infers markdown mention chips without metadata', () => {
        const content =
            'Open [@Computer Use](plugin://computer-use@openai-bundled), [@Chrome](app://computer-use/google-chrome), [mentions.md](/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md), and [components/ui](/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui)';

        expect(readMentionsFromMetadata(content, null)).toEqual([
            {
                end: 58,
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin',
                label: 'Computer Use',
                projection: 'capability-reference',
                start: 5,
                text: '[@Computer Use](plugin://computer-use@openai-bundled)',
            },
            {
                end: 103,
                id: 'app://computer-use/google-chrome',
                kind: 'app',
                label: 'Chrome',
                projection: 'capability-reference',
                start: 60,
                text: '[@Chrome](app://computer-use/google-chrome)',
            },
            {
                end: 182,
                id: '/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md',
                kind: 'file',
                label: 'mentions.md',
                projection: 'path-reference',
                start: 105,
                text: '[mentions.md](/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md)',
            },
            {
                end: content.length,
                id: '/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui',
                kind: 'directory',
                label: 'components/ui',
                projection: 'path-reference',
                start: 188,
                text: '[components/ui](/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui)',
            },
        ]);
    });
});
