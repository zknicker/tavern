import { describe, expect, it } from 'bun:test';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { buildCatalogItems, filterCatalogItems, formatCatalogName } from './skills-catalog.tsx';

describe('skills catalog rows', () => {
    it('combines skills and plugins with stable type labels', () => {
        const items = buildCatalogItems({
            plugins: [
                createPlugin({
                    id: 'codex',
                    name: 'Codex',
                    source: 'Codex',
                }),
            ],
            skills: [
                createSkill({
                    id: 'browser',
                    name: 'Browser',
                }),
            ],
        });

        expect(items.map((item) => `${item.kind}:${item.item.id}`)).toEqual([
            'skill:browser',
            'plugin:codex',
        ]);
    });

    it('hides internal Tavern runtime plugins from the catalog', () => {
        const items = buildCatalogItems({
            plugins: [
                createPlugin({
                    id: 'codex',
                    name: 'Codex',
                    source: 'Codex',
                }),
                createPlugin({
                    id: 'tavern-cortex',
                    name: 'Tavern Cortex',
                    source: 'OpenClaw',
                }),
                createPlugin({
                    id: 'tavern-workspace',
                    name: 'Tavern Workspace',
                    source: 'OpenClaw',
                }),
            ],
            skills: [],
        });

        expect(items.map((item) => item.item.id)).toEqual(['codex']);
    });

    it('filters by plugin source and skill description', () => {
        const items = buildCatalogItems({
            plugins: [
                createPlugin({
                    id: 'codex',
                    name: 'Codex',
                    source: 'Codex',
                }),
            ],
            skills: [
                createSkill({
                    description: 'Reads files and pages.',
                    id: 'browser',
                    name: 'Browser',
                }),
            ],
        });

        expect(filterCatalogItems(items, 'codex').map((item) => item.item.id)).toEqual(['codex']);
        expect(filterCatalogItems(items, 'pages').map((item) => item.item.id)).toEqual(['browser']);
    });

    it('filters by setup diagnostic text', () => {
        const items = buildCatalogItems({
            plugins: [],
            skills: [
                createSkill({
                    dependencyState: 'missing',
                    diagnostic: 'Missing bin op',
                    id: '1password',
                    name: '1password',
                    usability: 'not_usable',
                }),
            ],
        });

        expect(filterCatalogItems(items, 'bin op').map((item) => item.item.id)).toEqual([
            '1password',
        ]);
    });

    it('formats catalog names for display and search', () => {
        const items = buildCatalogItems({
            plugins: [
                createPlugin({
                    id: 'openai',
                    name: 'openai',
                    source: 'OpenClaw',
                }),
            ],
            skills: [
                createSkill({
                    id: 'linear-cli',
                    name: 'linear-cli',
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

    it('filters Codex-only catalog items by runtime surface label', () => {
        const items = buildCatalogItems({
            plugins: [
                createPlugin({
                    id: 'codex',
                    name: 'Codex',
                    source: 'Codex',
                }),
            ],
            skills: [
                createSkill({
                    id: 'git',
                    name: 'git',
                    surface: 'codex',
                }),
            ],
        });

        expect(filterCatalogItems(items, 'codex only').map((item) => item.item.id)).toEqual([
            'codex',
            'git',
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
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        id,
        name,
        surface: 'openclaw',
        updatedAt: null,
        usability: 'enabled',
        version: null,
        ...rest,
    };
}

function createPlugin(
    input: Partial<SkillListOutput['plugins'][number]> & {
        id: string;
        name: string;
        source: string;
    }
): SkillListOutput['plugins'][number] {
    const { id, name, source, ...rest } = input;

    return {
        description: null,
        diagnostic: null,
        enabled: true,
        id,
        name,
        source,
        updatedAt: null,
        usability: 'enabled',
        ...rest,
    };
}
