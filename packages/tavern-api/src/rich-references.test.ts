import { describe, expect, it } from 'bun:test';
import {
    formatAgentReferenceTarget,
    formatAppReferenceTarget,
    formatSkillReferenceTarget,
    parseAgentReferenceTarget,
    parseAppReferenceTarget,
    parseSkillReferenceTarget,
    parseTavernRichReferences,
    parseUserReferenceTarget,
} from './rich-references.ts';

describe('Tavern rich references', () => {
    it('formats and parses stable agent, app, and skill targets', () => {
        expect(formatAgentReferenceTarget('agent:planner')).toBe('agent://agent%3Aplanner');
        expect(parseAgentReferenceTarget('agent://agent%3Aplanner')).toBe('agent:planner');

        expect(formatAppReferenceTarget('com.google.Chrome')).toBe(
            'app://computer-use/com.google.Chrome'
        );
        expect(parseAppReferenceTarget('app://computer-use/com.google.Chrome')).toBe(
            'com.google.Chrome'
        );

        expect(formatSkillReferenceTarget('agent-browser')).toBe('skill://agent-browser');
        expect(parseSkillReferenceTarget('skill://agent-browser')).toBe('agent-browser');
    });

    it('parses explicit markdown links into rich references', () => {
        const content =
            'Ask [@Planner](agent://agent%3Aplanner), use [$ui](skill://ui), open [@Chrome](app://computer-use/com.google.Chrome), and inspect [specs/mentions.md](/repo/specs/mentions.md).';

        expect(parseTavernRichReferences(content)).toEqual([
            {
                end: 39,
                id: 'agent://agent%3Aplanner',
                kind: 'agent',
                label: 'Planner',
                projection: 'agent-reference',
                start: 4,
                text: '[@Planner](agent://agent%3Aplanner)',
            },
            {
                end: 62,
                id: 'skill://ui',
                kind: 'skill',
                label: 'ui',
                projection: 'skill-activation',
                start: 45,
                text: '[$ui](skill://ui)',
            },
            {
                end: 116,
                id: 'app://computer-use/com.google.Chrome',
                kind: 'app',
                label: 'Chrome',
                projection: 'capability-reference',
                start: 69,
                text: '[@Chrome](app://computer-use/com.google.Chrome)',
            },
            {
                end: 174,
                id: '/repo/specs/mentions.md',
                kind: 'file',
                label: 'specs/mentions.md',
                projection: 'path-reference',
                start: 130,
                text: '[specs/mentions.md](/repo/specs/mentions.md)',
            },
        ]);
    });

    it('leaves bare mention-looking text unparsed', () => {
        expect(parseTavernRichReferences('@Planner $ui B0TESTASIN')).toEqual([]);
    });

    it('parses explicit user references', () => {
        expect(parseUserReferenceTarget('user://usr_tavern')).toBe('usr_tavern');
        expect(parseTavernRichReferences('Ask [@You](user://usr_tavern).')).toEqual([
            expect.objectContaining({
                id: 'user://usr_tavern',
                kind: 'user',
                label: 'You',
            }),
        ]);
    });

    it('parses skill targets independently from filesystem paths', () => {
        const content = 'Use [$space-skill](skill://space-skill) now.';

        expect(parseTavernRichReferences(content)).toEqual([
            {
                end: 39,
                id: 'skill://space-skill',
                kind: 'skill',
                label: 'space-skill',
                projection: 'skill-activation',
                start: 4,
                text: '[$space-skill](skill://space-skill)',
            },
        ]);
    });

    it('treats explicit SKILL.md paths as file references, not skill activations', () => {
        const content = 'Read [$ui](/Users/zknicker/.agents/skills/ui/SKILL.md).';

        expect(parseTavernRichReferences(content)).toEqual([
            {
                end: 54,
                id: '/Users/zknicker/.agents/skills/ui/SKILL.md',
                kind: 'file',
                label: 'ui',
                projection: 'path-reference',
                start: 5,
                text: '[$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)',
            },
        ]);
    });
});
