import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import type { AgentListOutput, PluginListOutput, SkillListOutput } from '../../../lib/trpc.tsx';
import { AgentPluginRowView, AgentSkillRow } from './ability-rows.tsx';

const agent = {
    enabledPluginIds: ['merchbase'],
    enabledSkillIds: ['pdf'],
    id: 'agent_123',
    name: 'Tavern',
} as unknown as AgentListOutput['agents'][number];

describe('agent ability rows', () => {
    test('renders a granted plugin without hints when healthy', () => {
        const markup = renderToString(
            <AgentPluginRowView
                agent={agent}
                health={{ healthy: true, reason: null }}
                isSaving={false}
                onRemove={() => undefined}
                plugin={createPlugin({ enabled: true })}
            />
        );

        expect(markup).toContain('Remove MerchBase from Tavern');
        expect(markup).not.toContain('Disabled in Plugins');
        expect(markup).not.toContain('Enable it in Plugins first');
    });

    test('hints when a granted plugin is unhealthy but keeps removal available', () => {
        const markup = renderToString(
            <AgentPluginRowView
                agent={agent}
                health={{ healthy: false, reason: 'MerchBase is not reachable.' }}
                isSaving={false}
                onRemove={() => undefined}
                plugin={createPlugin({ enabled: true })}
            />
        );

        expect(markup).toContain('MerchBase is not reachable.');
        expect(markup).toContain('Remove MerchBase from Tavern');
        expect(markup).not.toContain('disabled=""');
    });

    test('hints when a granted plugin is globally disabled', () => {
        const markup = renderToString(
            <AgentPluginRowView
                agent={agent}
                health={{ healthy: false, reason: 'MerchBase is disabled.' }}
                isSaving={false}
                onRemove={() => undefined}
                plugin={createPlugin({ enabled: false })}
            />
        );

        expect(markup).toContain('Disabled in Plugins');
    });

    test('hints when an assigned skill was disabled globally', () => {
        const markup = renderToString(
            <AgentSkillRow
                agent={agent}
                isSaving={false}
                onRemove={() => undefined}
                skill={createSkill({ enabled: false, usability: 'disabled' })}
            />
        );

        expect(markup).toContain('Disabled in Skills');
        expect(markup).toContain('Remove PDF from Tavern');
    });

    test('surfaces the diagnostic for an assigned skill that needs setup', () => {
        const markup = renderToString(
            <AgentSkillRow
                agent={agent}
                isSaving={false}
                onRemove={() => undefined}
                skill={createSkill({
                    diagnostic: 'Missing pdftk binary.',
                    enabled: true,
                    usability: 'not_usable',
                })}
            />
        );

        expect(markup).toContain('Missing pdftk binary.');
    });
});

function createPlugin(input: { enabled: boolean }): PluginListOutput['plugins'][number] {
    return {
        config: {},
        description: 'Analyze Amazon Merch sales and product data from MerchBase.',
        displayName: 'MerchBase',
        enabled: input.enabled,
        id: 'merchbase',
        secrets: [{ hasValue: true, name: 'apiKey' }],
        services: [
            {
                description: 'Read-only MerchBase sales, product, catalog, and design tools.',
                displayName: 'MerchBase',
                enabled: true,
                healthCapabilities: ['plugin.merchbase'],
                id: 'merchbase',
                scopes: [],
            },
        ],
        updatedAt: '2026-06-23T12:00:00.000Z',
    };
}

function createSkill(input: {
    diagnostic?: string;
    enabled: boolean;
    usability: SkillListOutput['skills'][number]['usability'];
}): SkillListOutput['skills'][number] {
    return {
        allowedTools: null,
        dependencyState: input.usability === 'not_usable' ? 'missing' : 'ready',
        description: 'Read and produce PDF files.',
        diagnostic: input.diagnostic ?? null,
        enabled: input.enabled,
        id: 'pdf',
        missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
        name: 'pdf',
        plugin: null,
        readOnly: false,
        surface: 'agent',
        updatedAt: null,
        usability: input.usability,
        version: null,
    };
}
