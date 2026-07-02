import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getRuntimeCapability, refreshRuntimeCapabilities } from '../capabilities/store';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import { getMerchbaseSettings, queryMerchbaseAction, saveMerchbaseSettings } from './merchbase';
import { createMerchbaseToolsForAgent } from './merchbase-tools';
import { handlePluginsRequest } from './routes';
import { getPlugin } from './store';

const merchbaseClientMock = vi.hoisted(() => ({
    accountsGetQuery: vi.fn(),
    createClient: vi.fn(),
    salesSummaryQuery: vi.fn(),
}));

vi.mock('@merchbase/http-client', () => ({
    createMerchbaseClient: merchbaseClientMock.createClient,
}));

const envKeys = [] as const;

describe('MerchBase Plugin settings', () => {
    beforeEach(async () => {
        for (const key of envKeys) {
            process.env[key] = '';
        }
        merchbaseClientMock.createClient.mockReset();
        merchbaseClientMock.accountsGetQuery.mockReset();
        merchbaseClientMock.salesSummaryQuery.mockReset();
        merchbaseClientMock.createClient.mockReturnValue({
            accounts: {
                get: {
                    query: merchbaseClientMock.accountsGetQuery,
                },
            },
            sales: {
                summary: {
                    query: merchbaseClientMock.salesSummaryQuery,
                },
            },
        });
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        for (const key of envKeys) {
            delete process.env[key];
        }
    });

    test('defaults new settings to MerchBase production', () => {
        expect(getMerchbaseSettings()).toMatchObject({
            apiKeyConfigured: false,
            baseUrl: 'https://app.merchbase.co',
            enabled: false,
            enablementSource: 'settings',
        });
    });

    test('stores config and secrets in dedicated Plugin tables', () => {
        const settings = saveMerchbaseSettings({
            apiKey: 'secret-key',
            baseUrl: 'https://app.merchbase.co',
            defaultAccount: 'acct_123',
            defaultMarketplace: 'US',
            enabled: true,
        });

        expect(settings).toMatchObject({
            apiKeyConfigured: true,
            defaultAccount: 'acct_123',
            defaultMarketplace: 'US',
            enabled: true,
            enablementSource: 'settings',
        });
        expect(getPlugin('merchbase').secrets).toEqual([{ hasValue: true, name: 'apiKey' }]);
        expect(
            getDb()
                .prepare('SELECT config_json FROM runtime_plugins WHERE id = $id')
                .get({ $id: 'merchbase' })
        ).toMatchObject({
            config_json: JSON.stringify({
                baseUrl: 'https://app.merchbase.co',
                defaultAccount: 'acct_123',
                defaultMarketplace: 'US',
            }),
        });
        expect(
            getDb()
                .prepare('SELECT secret_json FROM runtime_plugin_secrets WHERE plugin_id = $id')
                .get({ $id: 'merchbase' })
        ).toMatchObject({ secret_json: JSON.stringify({ apiKey: 'secret-key' }) });
    });

    test('runs read actions through the configured Plugin client', async () => {
        saveMerchbaseSettings({
            apiKey: 'secret-key',
            baseUrl: 'https://app.merchbase.co',
            defaultAccount: 'acct_123',
            defaultMarketplace: 'US',
            enabled: true,
        });
        merchbaseClientMock.salesSummaryQuery.mockResolvedValue({ unitsSold: 42 });

        const result = await queryMerchbaseAction({
            action: 'sales.summary',
            input: { range: '10d' },
        });

        expect(merchbaseClientMock.createClient).toHaveBeenCalledWith({
            apiKey: 'secret-key',
            baseUrl: 'https://app.merchbase.co',
            headers: {
                'x-merchbase-account': 'acct_123',
                'x-merchbase-marketplace': 'US',
            },
        });
        expect(merchbaseClientMock.salesSummaryQuery).toHaveBeenCalledWith({
            marketplace: 'US',
            range: '10d',
        });
        expect(result).toEqual({
            action: 'sales.summary',
            result: { unitsSold: 42 },
        });
    });

    test('exposes MerchBase tools only to agents with the Plugin grant', () => {
        saveMerchbaseSettings({
            apiKey: 'secret-key',
            baseUrl: 'https://app.merchbase.co',
            enabled: true,
        });

        expect(
            Object.keys(
                createMerchbaseToolsForAgent({
                    enabledPluginIds: ['merchbase'],
                    enabledSkillIds: [],
                    id: 'agt_primary',
                    isAdmin: true,
                    name: 'Tavern',
                    primaryColor: null,
                    workspaceFolder: '/tmp/tavern-agent',
                })
            )
        ).toEqual(expect.arrayContaining(['merchbase_sales_series', 'merchbase_products_get']));
        expect(
            createMerchbaseToolsForAgent({
                enabledPluginIds: [],
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-agent',
            })
        ).toEqual({});
    });

    test('refreshes and publishes MerchBase capability after settings saves', async () => {
        saveMerchbaseSettings({ enabled: false });
        await refreshRuntimeCapabilities({ ids: ['plugin.merchbase'] });
        expect(getRuntimeCapability('plugin.merchbase')).toMatchObject({
            healthy: false,
            state: 'unavailable',
        });

        saveMerchbaseSettings({
            apiKey: 'old-key',
            enabled: true,
        });
        merchbaseClientMock.accountsGetQuery.mockResolvedValue({
            accountId: 'acct_123',
            marketplace: 'US',
        });
        const events: string[] = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => {
            if (event.type === 'capability.updated') {
                events.push(event.capability);
            }
        });

        try {
            const response = await handlePluginsRequest(
                new Request('http://runtime.test/plugins/merchbase/settings', {
                    body: JSON.stringify({
                        apiKey: 'new-key',
                        enabled: true,
                    }),
                    headers: {
                        [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                    },
                    method: 'PUT',
                })
            );

            expect(response?.status).toBe(200);
            expect(getRuntimeCapability('plugin.merchbase')).toMatchObject({
                healthy: true,
                metadata: {
                    accountId: 'acct_123',
                    baseUrl: 'https://app.merchbase.co',
                    marketplace: 'US',
                },
                state: 'healthy',
            });
            expect(events).toContain('plugin.merchbase');
        } finally {
            unsubscribe();
        }
    });
});
