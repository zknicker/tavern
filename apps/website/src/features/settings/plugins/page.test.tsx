import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import type { AgentListOutput, PluginListOutput } from '../../../lib/trpc.tsx';
import { GoogleSettingsCard } from './google-settings-card.tsx';
import { GoogleSettingsDialogBody } from './google-settings-dialog.tsx';
import { AgentPluginGrantRow, MerchbaseSettingsCard } from './page.tsx';

describe('MerchBase Plugin settings', () => {
    test('renders the plugin row without exposing connection details', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKey: 'sk_live_123',
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
                    apiKey: '',
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

    test('renders Google setup without exposing OAuth credentials', () => {
        const markup = renderToString(
            <GoogleSettingsCard
                onConnect={() => undefined}
                onDisconnect={() => undefined}
                onSave={() => undefined}
                settings={{
                    calendarEnabled: true,
                    connected: false,
                    connectedAccountEmail: null,
                    enabled: true,
                    grantedScopes: [],
                    missingCalendarScopes: ['https://www.googleapis.com/auth/calendar.events'],
                    updatedAt: '2026-07-05T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Google');
        expect(markup).toContain('Set up');
        expect(markup).toContain('Needs setup');
        expect(markup).toContain('Disable Google');
        expect(markup).not.toContain('client-id.apps.googleusercontent.com');
        expect(markup).not.toContain('client-secret');
        expect(markup).not.toContain('calendar.events');
    });

    test('renders connected Google as configurable', () => {
        const markup = renderToString(
            <GoogleSettingsCard
                onConnect={() => undefined}
                onDisconnect={() => undefined}
                onSave={() => undefined}
                settings={{
                    calendarEnabled: true,
                    connected: true,
                    connectedAccountEmail: 'zach@example.com',
                    enabled: true,
                    grantedScopes: ['https://www.googleapis.com/auth/calendar.events'],
                    missingCalendarScopes: [],
                    updatedAt: '2026-07-05T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Configure');
        expect(markup).not.toContain('Needs setup');
        expect(markup).not.toContain('zach@example.com');
    });

    test('renders Google dialog with service and connection hierarchy', () => {
        const markup = renderToString(
            <GoogleSettingsDialogBody
                draft={{
                    calendarEnabled: true,
                    enabled: true,
                }}
                isSaving={false}
                onConnect={async () => undefined}
                onDisconnect={async () => undefined}
                onDraftChange={() => undefined}
                settings={{
                    calendarEnabled: true,
                    connected: false,
                    connectedAccountEmail: null,
                    enabled: true,
                    grantedScopes: [],
                    missingCalendarScopes: ['https://www.googleapis.com/auth/calendar.events'],
                    updatedAt: '2026-07-05T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Services');
        expect(markup).toContain('Connection');
        expect(markup).toContain('Calendar');
        expect(markup).not.toContain('Needs connection');
        expect(markup).not.toContain('OAuth client ID');
        expect(markup).not.toContain('OAuth client secret');
        expect(markup).toContain('Connect');
    });

    test('does not render Google OAuth client fields when connect fails', () => {
        const markup = renderToString(
            <GoogleSettingsDialogBody
                draft={{
                    calendarEnabled: true,
                    enabled: false,
                }}
                error="Google connection failed."
                isSaving={false}
                onConnect={async () => undefined}
                onDisconnect={async () => undefined}
                onDraftChange={() => undefined}
                settings={{
                    calendarEnabled: true,
                    connected: false,
                    connectedAccountEmail: null,
                    enabled: false,
                    grantedScopes: [],
                    missingCalendarScopes: ['https://www.googleapis.com/auth/calendar.events'],
                    updatedAt: '2026-07-05T12:00:00.000Z',
                }}
            />
        );

        expect(markup).not.toContain('OAuth client settings');
        expect(markup).not.toContain('Client ID');
        expect(markup).toContain('Google connection failed.');
    });

    test('renders an agent Plugin grant toggle without configuration', () => {
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
        } as unknown as PluginListOutput['plugins'][number];

        const markup = renderToString(
            <AgentPluginGrantRow
                agent={agent}
                health={{ healthy: true, reason: null }}
                isSaving={false}
                onEnabledChange={() => undefined}
                plugin={plugin}
            />
        );

        expect(markup).toContain('Revoke MerchBase for Tavern');
        expect(markup).not.toContain('Configure');
        expect(markup).not.toContain('Enable it in Plugins first');
    });

    test('blocks new grants while the plugin is unhealthy', () => {
        const agent = {
            enabledPluginIds: [],
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
        } as unknown as PluginListOutput['plugins'][number];

        const markup = renderToString(
            <AgentPluginGrantRow
                agent={agent}
                health={{ healthy: false, reason: 'MerchBase is not reachable.' }}
                isSaving={false}
                onEnabledChange={() => undefined}
                plugin={plugin}
            />
        );

        expect(markup).toContain('MerchBase is not reachable.');
        expect(markup).toContain('disabled');
    });

    test('does not duplicate plugin disabled state in agent grant rows', () => {
        const agent = {
            enabledPluginIds: ['google'],
            id: 'agent_123',
            name: 'Tavern',
        } as unknown as AgentListOutput['agents'][number];
        const plugin = {
            config: {},
            description: 'Read Google Workspace data through Tavern-managed Google services.',
            displayName: 'Google',
            enabled: false,
            id: 'google',
            secrets: [],
            services: [
                {
                    description: 'Read and create Google Calendar events.',
                    displayName: 'Google Calendar',
                    enabled: true,
                    healthCapabilities: ['plugin.google.calendar'],
                    id: 'calendar',
                    scopes: ['https://www.googleapis.com/auth/calendar.events'],
                },
            ],
            updatedAt: '2026-07-05T12:00:00.000Z',
        } as unknown as PluginListOutput['plugins'][number];

        const markup = renderToString(
            <AgentPluginGrantRow
                agent={agent}
                health={{ healthy: false, reason: 'Google is disabled.' }}
                isSaving={false}
                onEnabledChange={() => undefined}
                plugin={plugin}
            />
        );

        expect(markup).toContain('Read Google Workspace data');
        expect(markup).toContain('Enable it in Plugins first');
        expect(markup).not.toContain('Grant is saved');
    });

    test('surfaces a merchbase skill conflict without exposing the path inline', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKey: 'sk_live_123',
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
                    apiKey: 'sk_live_123',
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
