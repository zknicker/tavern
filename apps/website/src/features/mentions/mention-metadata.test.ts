import { describe, expect, it } from 'bun:test';
import { readMentionsFromMarkdown } from './mention-metadata.ts';

describe('readMentionsFromMarkdown', () => {
    it('reads explicit rich reference links from message content', () => {
        const content =
            'Ask [@Tavern](agent://agt_primary), open [@Computer Use](plugin://computer-use@openai-bundled), [@Chrome](app://computer-use/google-chrome), read [$ui](skill://ui), [mentions.md](/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md), and [components/ui](/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui)';

        expect(readMentionsFromMarkdown(content)).toEqual([
            {
                end: 34,
                id: 'agent://agt_primary',
                kind: 'agent',
                label: 'Tavern',
                projection: 'agent-reference',
                start: 4,
                text: '[@Tavern](agent://agt_primary)',
            },
            {
                end: 94,
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin',
                label: 'Computer Use',
                projection: 'capability-reference',
                start: 41,
                text: '[@Computer Use](plugin://computer-use@openai-bundled)',
            },
            {
                end: 139,
                id: 'app://computer-use/google-chrome',
                kind: 'app',
                label: 'Chrome',
                projection: 'capability-reference',
                start: 96,
                text: '[@Chrome](app://computer-use/google-chrome)',
            },
            {
                end: 163,
                id: 'skill://ui',
                kind: 'skill',
                label: 'ui',
                projection: 'skill-activation',
                start: 146,
                text: '[$ui](skill://ui)',
            },
            {
                end: 242,
                id: '/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md',
                kind: 'file',
                label: 'mentions.md',
                projection: 'path-reference',
                start: 165,
                text: '[mentions.md](/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md)',
            },
            {
                end: content.length,
                id: '/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui',
                kind: 'directory',
                label: 'components/ui',
                projection: 'path-reference',
                start: 248,
                text: '[components/ui](/Users/zknicker/.codex/worktrees/1b41/tavern/apps/website/src/components/ui)',
            },
        ]);
    });

    it('ignores bare mention-looking text', () => {
        expect(readMentionsFromMarkdown('@Tavern and $ui are plain text')).toEqual([]);
    });
});
