import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import type { AgentListOutput, PluginListOutput } from '../../../lib/trpc.tsx';
import { AgentPluginGrantRow, MerchbaseSettingsCard } from './page.tsx';

describe('MerchBase Plugin settings', () => {
    test('renders the plugin row without exposing connection details', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKeyConfigured: true,
                    baseUrl: 'https://app.merchbase.co',
                    defaultAccount: 'acct_123',
                    defaultMarketplace: 'US',
                    enabled: true,
                    enablementSource: 'settings',
                    skillConflict: null,
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('MerchBase');
        expect(markup).toContain('Analyze Amazon Merch sales');
        expect(markup).toContain('Configure');
        expect(markup).toContain('Disable MerchBase');
        expect(markup).not.toContain('Enabled');
        expect(markup).not.toContain('Off');
        expect(markup).not.toContain('https://app.merchbase.co');
        expect(markup).not.toContain('acct_123');
        expect(markup).not.toContain('sk_live');
    });

    test('prompts setup when the API key is missing', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKeyConfigured: false,
                    baseUrl: 'https://app.merchbase.co',
                    defaultAccount: null,
                    defaultMarketplace: 'US',
                    enabled: false,
                    enablementSource: 'settings',
                    skillConflict: null,
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Needs setup');
        expect(markup).toContain('Set up');
        expect(markup).toContain('Enable MerchBase');
        expect(markup).not.toContain('Configure');
    });

    test('shows a configure action on agent Plugin grant rows', () => {
        const agent = {
            enabledPluginIds: ['merchbase'],
            id: 'agent_123',
            name: 'Tavern',
        } as unknown as AgentListOutput['agents'][number];
        const plugin = {
            config: {},
            description: 'Analyze Amazon Merch sales and product data from MerchBase.',
            displayName: 'MerchBase',
            enabled: true,
            id: 'merchbase',
            secrets: [{ hasValue: true, name: 'apiKey' }],
            updatedAt: '2026-06-23T12:00:00.000Z',
        } as unknown as PluginListOutput['plugins'][number];

        const markup = renderToString(
            <AgentPluginGrantRow
                agent={agent}
                configureAction={<button type="button">Configure</button>}
                isSaving={false}
                onEnabledChange={() => undefined}
                plugin={plugin}
            />
        );

        expect(markup).toContain('Configure');
        expect(markup).toContain('Revoke MerchBase for Tavern');
    });

    test('surfaces a merchbase skill conflict without exposing the path inline', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKeyConfigured: true,
                    baseUrl: 'https://app.merchbase.co',
                    defaultAccount: null,
                    defaultMarketplace: 'US',
                    enabled: false,
                    enablementSource: 'settings',
                    skillConflict: {
                        skillName: 'merchbase',
                        skillPath: '/tmp/agent/skills/merchbase',
                    },
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Skill conflict');
        expect(markup).toContain('Enable MerchBase');
        expect(markup).not.toContain('Off');
        expect(markup).not.toContain('/tmp/agent/skills/merchbase');
    });

    test('marks environment-controlled enablement as locked', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKeyConfigured: true,
                    baseUrl: 'https://app.merchbase.co',
                    defaultAccount: 'acct_123',
                    defaultMarketplace: 'US',
                    enabled: true,
                    enablementSource: 'environment',
                    skillConflict: null,
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).not.toContain('From .env');
        expect(markup).toContain('MerchBase enablement is managed by local Tavern configuration');
    });
});
