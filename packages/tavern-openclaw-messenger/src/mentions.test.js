import { describe, expect, it } from 'bun:test';
import { buildBodyForAgentWithMentions } from './mentions.js';

describe('buildBodyForAgentWithMentions', () => {
    it('projects skill mentions as Codex-style skill context', () => {
        expect(
            buildBodyForAgentWithMentions({
                metadata: {
                    tavern: {
                        mentions: [
                            {
                                end: 53,
                                id: '/Users/zknicker/.agents/skills/ui/SKILL.md',
                                kind: 'skill',
                                label: 'ui',
                                projection: 'skill-context',
                                start: 4,
                                text: '[$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
                            },
                        ],
                    },
                },
                text: 'Use [$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
            })
        ).toBe(
            [
                '<skill>',
                '<name>ui</name>',
                '<path>/Users/zknicker/.agents/skills/ui/SKILL.md</path>',
                '</skill>',
                '',
                'Use [$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
            ].join('\n')
        );
    });

    it('uses the raw skill markdown name for skill context when the UI label is prettier', () => {
        expect(
            buildBodyForAgentWithMentions({
                metadata: {
                    tavern: {
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
                    },
                },
                text: 'Use [$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
            })
        ).toBe(
            [
                '<skill>',
                '<name>agent-browser</name>',
                '<path>/Users/zknicker/.agents/skills/agent-browser/SKILL.md</path>',
                '</skill>',
                '',
                'Use [$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
            ].join('\n')
        );
    });

    it('preserves capability and path mentions as visible markdown only', () => {
        expect(
            buildBodyForAgentWithMentions({
                metadata: {
                    tavern: {
                        mentions: [
                            {
                                end: 44,
                                id: 'plugin://chrome@openai-bundled',
                                kind: 'plugin',
                                label: 'Chrome',
                                projection: 'capability-reference',
                                start: 5,
                                text: '[@Chrome](plugin://chrome@openai-bundled)',
                            },
                            {
                                end: 77,
                                id: '/repo/specs/mentions.md',
                                kind: 'file',
                                label: 'mentions.md',
                                projection: 'path-reference',
                                start: 49,
                                text: '[mentions.md](/repo/specs/mentions.md)',
                            },
                            {
                                end: 123,
                                id: 'plugin://computer-use@openai-bundled',
                                kind: 'app',
                                label: 'Chrome',
                                metadata: {
                                    bundleId: 'com.google.Chrome',
                                },
                                projection: 'capability-reference',
                                start: 82,
                                text: '[@Chrome](plugin://computer-use@openai-bundled)',
                            },
                            {
                                end: 151,
                                id: '/repo/apps/website/src/components/ui',
                                kind: 'directory',
                                label: 'components/ui',
                                projection: 'path-reference',
                                start: 123,
                                text: '[components/ui](/repo/apps/website/src/components/ui)',
                            },
                            {
                                end: 194,
                                id: '/tmp/Screenshot.png',
                                kind: 'image',
                                label: 'Screenshot.png',
                                projection: 'image-input',
                                start: 156,
                                text: '## Screenshot.png: /tmp/Screenshot.png',
                            },
                        ],
                    },
                },
                text: [
                    'Open [@Chrome](plugin://chrome@openai-bundled) and [mentions.md](/repo/specs/mentions.md)',
                    'then [@Chrome](plugin://computer-use@openai-bundled), [components/ui](/repo/apps/website/src/components/ui),',
                    'and ## Screenshot.png: /tmp/Screenshot.png',
                ].join(' '),
            })
        ).toBe(
            [
                'Open [@Chrome](plugin://chrome@openai-bundled) and [mentions.md](/repo/specs/mentions.md)',
                'then [@Chrome](plugin://computer-use@openai-bundled), [components/ui](/repo/apps/website/src/components/ui),',
                'and ## Screenshot.png: /tmp/Screenshot.png',
            ].join(' ')
        );
    });
});
