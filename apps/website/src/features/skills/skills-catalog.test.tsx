import { describe, expect, it } from 'bun:test';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { buildCatalogItems, filterCatalogItems } from './skills-catalog.tsx';

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
});

function createSkill(
    input: Partial<SkillListOutput['skills'][number]> & {
        id: string;
        name: string;
    }
): SkillListOutput['skills'][number] {
    const { id, name, ...rest } = input;

    return {
        agentCount: 0,
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
