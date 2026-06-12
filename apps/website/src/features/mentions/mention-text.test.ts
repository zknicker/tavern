import { describe, expect, it } from 'bun:test';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    getActiveMentionQuery,
    normalizeMentions,
    reconcileMentions,
    selectMention,
} from './mention-text.ts';

describe('mention text helpers', () => {
    it('finds the active @ query before the caret', () => {
        expect(getActiveMentionQuery('use @Hat', 8)).toEqual({
            end: 8,
            query: 'Hat',
            start: 4,
            trigger: '@',
        });
    });

    it('finds the active $ query as a skills-only trigger', () => {
        expect(getActiveMentionQuery('use $wik', 8)).toEqual({
            end: 8,
            query: 'wik',
            start: 4,
            trigger: '$',
        });
    });

    it('finds the leading / command query and ignores mid-message slashes', () => {
        expect(getActiveMentionQuery('/mod', 4)).toEqual({
            end: 4,
            query: 'mod',
            start: 0,
            trigger: '/',
        });
        expect(getActiveMentionQuery('see /mod', 8)).toBeNull();
        expect(getActiveMentionQuery('/usr/local', 10)).toBeNull();
    });

    it('keeps mention offsets aligned when text changes before the mention', () => {
        const mentions = [
            {
                end: 13,
                id: 'hatch-pet',
                kind: 'skill' as const,
                label: 'Hatch Pet',
                projection: 'skill-context' as const,
                start: 4,
                text: 'Hatch Pet',
            },
        ];

        expect(reconcileMentions('use Hatch Pet', 'please use Hatch Pet', mentions)).toEqual([
            {
                ...mentions[0],
                end: 20,
                start: 11,
            },
        ]);
    });

    it('drops mentions when their text no longer matches', () => {
        expect(
            normalizeMentions('use Hatch', [
                {
                    end: 13,
                    id: 'hatch-pet',
                    kind: 'skill',
                    label: 'Hatch Pet',
                    projection: 'skill-context',
                    start: 4,
                    text: 'Hatch Pet',
                },
            ])
        ).toEqual([]);
    });

    it('keeps later mention offsets aligned when selecting a new earlier mention', () => {
        expect(
            selectMention({
                activeQuery: {
                    end: 8,
                    query: 'Git',
                    start: 4,
                    trigger: '@',
                },
                content: 'use @Ins then Hatch Pet',
                mentions: [
                    {
                        end: 23,
                        id: 'hatch-pet',
                        kind: 'skill',
                        label: 'Hatch Pet',
                        projection: 'skill-context',
                        start: 14,
                        text: 'Hatch Pet',
                    },
                ],
                option: {
                    id: '/Users/zknicker/.codex/skills/skill-installer/SKILL.md',
                    insertText: 'Skill Installer',
                    kind: 'skill',
                    label: 'Skill Installer',
                    projection: 'skill-context',
                },
            }).nextMentions
        ).toEqual([
            {
                end: 19,
                id: '/Users/zknicker/.codex/skills/skill-installer/SKILL.md',
                kind: 'skill',
                label: 'Skill Installer',
                projection: 'skill-context',
                start: 4,
                text: 'Skill Installer',
            },
            {
                end: 34,
                id: 'hatch-pet',
                kind: 'skill',
                label: 'Hatch Pet',
                projection: 'skill-context',
                start: 25,
                text: 'Hatch Pet',
            },
        ]);
    });

    it('adds a trailing space after selecting a mention at the end of the prompt', () => {
        expect(
            selectMention({
                activeQuery: {
                    end: 11,
                    query: 'Hat',
                    start: 7,
                    trigger: '@',
                },
                content: 'launch @Hat',
                mentions: [],
                option: {
                    id: '/Users/zknicker/.codex/skills/hatch-pet/SKILL.md',
                    insertText: 'Hatch Pet',
                    kind: 'skill',
                    label: 'Hatch Pet',
                    projection: 'skill-context',
                },
            })
        ).toMatchObject({
            nextCaretIndex: 17,
            nextContent: 'launch Hatch Pet ',
            nextMentions: [
                {
                    end: 16,
                    id: '/Users/zknicker/.codex/skills/hatch-pet/SKILL.md',
                    kind: 'skill',
                    label: 'Hatch Pet',
                    projection: 'skill-context',
                    start: 7,
                    text: 'Hatch Pet',
                },
            ],
        });
    });

    it('compiles visible mention chips into markdown links for submission', () => {
        expect(
            compileMentionSubmission('launch Hatch Pet', [
                {
                    end: 16,
                    id: '/Users/zknicker/.codex/skills/hatch-pet/SKILL.md',
                    kind: 'skill',
                    label: 'Hatch Pet',
                    projection: 'skill-context',
                    start: 7,
                    text: 'Hatch Pet',
                },
            ])
        ).toEqual({
            content: 'launch [$Hatch Pet](/Users/zknicker/.codex/skills/hatch-pet/SKILL.md)',
            mentions: [
                {
                    end: 69,
                    id: '/Users/zknicker/.codex/skills/hatch-pet/SKILL.md',
                    kind: 'skill',
                    label: 'Hatch Pet',
                    projection: 'skill-context',
                    start: 7,
                    text: '[$Hatch Pet](/Users/zknicker/.codex/skills/hatch-pet/SKILL.md)',
                },
            ],
        });
    });

    it('compiles skill markdown with the raw skill text instead of the display label', () => {
        expect(
            compileMentionSubmission('use agent-browser', [
                {
                    end: 17,
                    id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                    kind: 'skill',
                    label: 'Agent Browser',
                    projection: 'skill-context',
                    start: 4,
                    text: 'agent-browser',
                },
            ])
        ).toEqual({
            content: 'use [$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
            mentions: [
                {
                    end: 75,
                    id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                    kind: 'skill',
                    label: 'Agent Browser',
                    projection: 'skill-context',
                    start: 4,
                    text: '[$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
                },
            ],
        });
    });

    it('compiles app, plugin, file, and directory mentions with spec markdown', () => {
        const cases = [
            {
                content: 'Use Computer Use',
                expectedContent: 'Use [@Computer Use](plugin://computer-use@openai-bundled)',
                expectedText: '[@Computer Use](plugin://computer-use@openai-bundled)',
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin' as const,
                label: 'Computer Use',
                projection: 'capability-reference' as const,
                text: 'Computer Use',
            },
            {
                content: 'Open Chrome',
                expectedContent: 'Open [@Chrome](plugin://computer-use@openai-bundled)',
                expectedText: '[@Chrome](plugin://computer-use@openai-bundled)',
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app' as const,
                label: 'Chrome',
                metadata: { bundleId: 'com.google.Chrome' },
                projection: 'capability-reference' as const,
                text: 'Chrome',
            },
            {
                content: 'Read specs/mentions.md',
                expectedContent: 'Read [specs/mentions.md](/repo/specs/mentions.md)',
                expectedText: '[specs/mentions.md](/repo/specs/mentions.md)',
                id: '/repo/specs/mentions.md',
                kind: 'file' as const,
                label: 'specs/mentions.md',
                projection: 'path-reference' as const,
                text: 'specs/mentions.md',
            },
            {
                content: 'Inspect apps/website/src/components/ui',
                expectedContent:
                    'Inspect [apps/website/src/components/ui](/repo/apps/website/src/components/ui)',
                expectedText:
                    '[apps/website/src/components/ui](/repo/apps/website/src/components/ui)',
                id: '/repo/apps/website/src/components/ui',
                kind: 'directory' as const,
                label: 'apps/website/src/components/ui',
                projection: 'path-reference' as const,
                text: 'apps/website/src/components/ui',
            },
        ];

        for (const testCase of cases) {
            const start = testCase.content.indexOf(testCase.text);
            const result = compileMentionSubmission(testCase.content, [
                {
                    end: start + testCase.text.length,
                    id: testCase.id,
                    kind: testCase.kind,
                    label: testCase.label,
                    metadata: testCase.metadata,
                    projection: testCase.projection,
                    start,
                    text: testCase.text,
                },
            ]);

            expect(result).toEqual({
                content: testCase.expectedContent,
                mentions: [
                    {
                        end: start + testCase.expectedText.length,
                        id: testCase.id,
                        kind: testCase.kind,
                        label: testCase.label,
                        metadata: testCase.metadata,
                        projection: testCase.projection,
                        start,
                        text: testCase.expectedText,
                    },
                ],
            });
        }
    });

    it('stores metadata for every mention kind after compiling a prompt', () => {
        const content = 'Use agent-browser Computer Use Chrome specs/mentions.md components/ui';
        const inputs = [
            {
                id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                kind: 'skill' as const,
                label: 'Agent Browser',
                projection: 'skill-context' as const,
                text: 'agent-browser',
            },
            {
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin' as const,
                label: 'Computer Use',
                projection: 'capability-reference' as const,
                text: 'Computer Use',
            },
            {
                id: 'plugin://computer-use@openai-bundled',
                kind: 'app' as const,
                label: 'Chrome',
                metadata: { bundleId: 'com.google.Chrome' },
                projection: 'capability-reference' as const,
                text: 'Chrome',
            },
            {
                id: '/repo/specs/mentions.md',
                kind: 'file' as const,
                label: 'specs/mentions.md',
                projection: 'path-reference' as const,
                text: 'specs/mentions.md',
            },
            {
                id: '/repo/apps/website/src/components/ui',
                kind: 'directory' as const,
                label: 'components/ui',
                projection: 'path-reference' as const,
                text: 'components/ui',
            },
        ].map((mention) => {
            const start = content.indexOf(mention.text);
            return {
                ...mention,
                end: start + mention.text.length,
                start,
            };
        });
        const compiled = compileMentionSubmission(content, inputs);

        expect(buildMentionMetadata(compiled.mentions)).toEqual({
            tavern: {
                mentions: compiled.mentions,
            },
        });
        expect(compiled).toEqual({
            content:
                'Use [$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md) [@Computer Use](plugin://computer-use@openai-bundled) [@Chrome](plugin://computer-use@openai-bundled) [specs/mentions.md](/repo/specs/mentions.md) [components/ui](/repo/apps/website/src/components/ui)',
            mentions: [
                {
                    end: 75,
                    id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                    kind: 'skill',
                    label: 'Agent Browser',
                    projection: 'skill-context',
                    start: 4,
                    text: '[$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
                },
                {
                    end: 129,
                    id: 'plugin://computer-use@openai-bundled',
                    kind: 'plugin',
                    label: 'Computer Use',
                    projection: 'capability-reference',
                    start: 76,
                    text: '[@Computer Use](plugin://computer-use@openai-bundled)',
                },
                {
                    end: 177,
                    id: 'plugin://computer-use@openai-bundled',
                    kind: 'app',
                    label: 'Chrome',
                    metadata: { bundleId: 'com.google.Chrome' },
                    projection: 'capability-reference',
                    start: 130,
                    text: '[@Chrome](plugin://computer-use@openai-bundled)',
                },
                {
                    end: 222,
                    id: '/repo/specs/mentions.md',
                    kind: 'file',
                    label: 'specs/mentions.md',
                    projection: 'path-reference',
                    start: 178,
                    text: '[specs/mentions.md](/repo/specs/mentions.md)',
                },
                {
                    end: 276,
                    id: '/repo/apps/website/src/components/ui',
                    kind: 'directory',
                    label: 'components/ui',
                    projection: 'path-reference',
                    start: 223,
                    text: '[components/ui](/repo/apps/website/src/components/ui)',
                },
            ],
        });
    });
});
