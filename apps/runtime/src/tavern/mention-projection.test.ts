import { describe, expect, it } from 'vitest';
import { projectTavernMessageForAgent } from './mention-projection.ts';

describe('projectTavernMessageForAgent', () => {
    it('projects explicitly linked enabled skill ids as a turn activation hint', () => {
        const projected = projectTavernMessageForAgent({
            content: 'Please use [$test-skill](skill://test-skill) for this turn.',
            enabledSkillIds: ['test-skill'],
        });

        expect(projected).toContain('<skill_reference_context>');
        expect(projected).toContain('- test-skill');
        expect(projected).not.toContain('<skill name=');
        expect(projected).not.toContain('SKILL.md');
        expect(projected).toContain('Please use [$test-skill](skill://test-skill) for this turn.');
    });

    it('does not activate linked skills the addressed agent does not have enabled', () => {
        const content = 'Please use [$test-skill](skill://test-skill) for this turn.';

        expect(
            projectTavernMessageForAgent({
                content,
                enabledSkillIds: ['other-skill'],
            })
        ).toBe(content);
    });

    it('deduplicates repeated enabled skill references', () => {
        const projected = projectTavernMessageForAgent({
            content: 'Use [$test-skill](skill://test-skill) then [$again](skill://test-skill).',
            enabledSkillIds: ['test-skill'],
        });

        expect(projected.match(/- test-skill/g)).toHaveLength(1);
    });

    it('does not project bare skill-looking text', () => {
        expect(
            projectTavernMessageForAgent({
                content: 'Please use $test-skill for this turn.',
                enabledSkillIds: ['test-skill'],
            })
        ).toBe('Please use $test-skill for this turn.');
    });
});
