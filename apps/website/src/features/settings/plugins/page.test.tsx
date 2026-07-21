import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { GoogleSettingsCard } from './google-settings-card.tsx';
import { GoogleSettingsDialogBody, getGoogleEnableLockReason } from './google-settings-dialog.tsx';
import { MerchbaseSettingsCard } from './page.tsx';

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

        expect(markup).not.toContain('Needs setup');
        expect(markup).toContain('Set up');
        expect(markup).toContain('MerchBase needs setup before it can be enabled');
        expect(markup).toContain('disabled=""');
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
        expect(markup).not.toContain('Needs setup');
        expect(markup).toContain('Disable Google');
        expect(markup).not.toContain('client-id.apps.googleusercontent.com');
        expect(markup).not.toContain('client-secret');
        expect(markup).not.toContain('calendar.events');
    });

    test('locks enabling a disconnected Google without a badge', () => {
        const markup = renderToString(
            <GoogleSettingsCard
                onConnect={() => undefined}
                onDisconnect={() => undefined}
                onSave={() => undefined}
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

        expect(markup).not.toContain('Needs setup');
        expect(markup).toContain('Google needs setup before it can be enabled');
        expect(markup).toContain('disabled=""');
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
        expect(markup).toContain('Connect Google before enabling the Plugin or using Calendar.');
        expect(markup).not.toContain('OAuth client ID');
        expect(markup).not.toContain('OAuth client secret');
        expect(markup).toContain('Connect');
    });

    test('locks Google enablement until setup is ready', () => {
        const reason = getGoogleEnableLockReason(
            {
                calendarEnabled: true,
                connected: false,
                connectedAccountEmail: null,
                enabled: false,
                grantedScopes: [],
                missingCalendarScopes: ['https://www.googleapis.com/auth/calendar.events'],
                updatedAt: '2026-07-05T12:00:00.000Z',
            },
            {
                calendarEnabled: true,
                enabled: false,
            }
        );

        expect(reason).toBe('Connect Google before enabling the Plugin.');
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
        expect(markup).toContain('Google setup failed');
        expect(markup).toContain('Google connection failed.');
        expect(markup).not.toContain('data-slot="field-error"');
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
        expect(markup).toContain('MerchBase enablement is managed by local Grotto configuration');
    });
});
