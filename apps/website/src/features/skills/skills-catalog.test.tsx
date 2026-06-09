import { describe, expect, it } from 'bun:test';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { buildCatalogItems, filterCatalogItems, formatCatalogName } from './skills-catalog.tsx';

describe('skills catalog rows', () => {
    it('combines skills and toolsets with stable type labels', () => {
        const items = buildCatalogItems({
            skills: [
                createSkill({
                    id: 'browser',
                    name: 'Browser',
                }),
            ],
            toolsets: [
                createToolset({
                    id: 'web',
                    name: 'Web',
                    tools: ['browser.open'],
                }),
            ],
        });

        expect(items.map((item) => `${item.kind}:${item.item.id}`)).toEqual([
            'skill:browser',
            'toolset:web',
        ]);
    });

    it('filters by toolset tools and skill description', () => {
        const items = buildCatalogItems({
            skills: [
                createSkill({
                    description: 'Reads files and pages.',
                    id: 'browser',
                    name: 'Browser',
                }),
            ],
            toolsets: [
                createToolset({
                    id: 'web',
                    name: 'Web',
                    tools: ['search.web'],
                }),
            ],
        });

        expect(filterCatalogItems(items, 'search.web').map((item) => item.item.id)).toEqual([
            'web',
        ]);
        expect(filterCatalogItems(items, 'pages').map((item) => item.item.id)).toEqual(['browser']);
    });

    it('filters by setup diagnostic text', () => {
        const items = buildCatalogItems({
            skills: [
                createSkill({
                    dependencyState: 'missing',
                    diagnostic: 'Missing bin op',
                    id: '1password',
                    name: '1password',
                    usability: 'not_usable',
                }),
            ],
            toolsets: [],
        });

        expect(filterCatalogItems(items, 'bin op').map((item) => item.item.id)).toEqual([
            '1password',
        ]);
    });

    it('formats catalog names for display and search', () => {
        const items = buildCatalogItems({
            skills: [
                createSkill({
                    id: 'linear-cli',
                    name: 'linear-cli',
                }),
            ],
            toolsets: [
                createToolset({
                    id: 'openai',
                    name: 'openai',
                }),
            ],
        });

        expect(formatCatalogName('linear-cli')).toBe('Linear CLI');
        expect(formatCatalogName('openai-docs')).toBe('OpenAI Docs');
        expect(formatCatalogName('computer-use:computer-use')).toBe('Computer Use');
        expect(items.map((item) => item.name)).toEqual(['Linear CLI', 'OpenAI']);
        expect(filterCatalogItems(items, 'Linear CLI').map((item) => item.item.id)).toEqual([
            'linear-cli',
        ]);
    });
});

function createSkill(
    input: Partial<SkillListOutput['skills'][number]> & {
        id: string;
        name: string;
    }
): SkillListOutput['skills'][number] {
    const { id, name, ...rest } = input;

    return {
        allowedTools: null,
        dependencyState: 'ready',
        description: null,
        diagnostic: null,
        enabled: true,
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        id,
        name,
        surface: 'hermes',
        updatedAt: null,
        usability: 'enabled',
        version: null,
        ...rest,
    };
}

function createToolset(
    input: Partial<SkillListOutput['toolsets'][number]> & {
        id: string;
        name: string;
    }
): SkillListOutput['toolsets'][number] {
    const { id, name, ...rest } = input;

    return {
        configured: true,
        description: null,
        diagnostic: null,
        enabled: true,
        id,
        name,
        tools: [],
        usability: 'enabled',
        ...rest,
    };
}
