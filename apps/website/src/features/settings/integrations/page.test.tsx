import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { MerchbaseSettingsCard } from './page.tsx';

describe('MerchBase Integration settings', () => {
    test('renders the integration row without exposing connection details', () => {
        const markup = renderToString(
            <MerchbaseSettingsCard
                onSave={() => undefined}
                settings={{
                    apiKeyConfigured: true,
                    baseUrl: 'https://app.merchbase.co',
                    defaultAccount: 'acct_123',
                    defaultMarketplace: 'US',
                    enabled: true,
                    skillConflict: null,
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('MerchBase');
        expect(markup).toContain('Enabled');
        expect(markup).toContain('Live sales data');
        expect(markup).toContain('Configure');
        expect(markup).not.toContain('https://app.merchbase.co');
        expect(markup).not.toContain('acct_123');
        expect(markup).not.toContain('sk_live');
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
                    skillConflict: {
                        skillName: 'merchbase',
                        skillPath: '/tmp/hermes/skills/merchbase',
                    },
                    updatedAt: '2026-06-23T12:00:00.000Z',
                }}
            />
        );

        expect(markup).toContain('Skill conflict');
        expect(markup).toContain('Off');
        expect(markup).not.toContain('/tmp/hermes/skills/merchbase');
    });
});
