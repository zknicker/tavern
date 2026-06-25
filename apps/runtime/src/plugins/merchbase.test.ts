import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getRuntimeCapability, refreshRuntimeCapabilities } from '../capabilities/store';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events';
import {
    ensureMerchbaseSkillForEnablement,
    getMerchbasePlugin,
    getMerchbaseSettings,
    queryMerchbaseAction,
    saveMerchbaseSettings,
} from './merchbase';
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

const envKeys = [
    'TAVERN_HERMES_HOME',
    'TAVERN_MERCHBASE_API_KEY',
    'TAVERN_MERCHBASE_BASE_URL',
    'TAVERN_MERCHBASE_DEFAULT_ACCOUNT',
    'TAVERN_MERCHBASE_DEFAULT_MARKETPLACE',
    'TAVERN_MERCHBASE_ENABLED',
] as const;

const tempDirs: string[] = [];

describe('MerchBase Plugin settings', () => {
    beforeEach(async () => {
        for (const key of envKeys) {
            process.env[key] = '';
        }
        process.env.TAVERN_HERMES_HOME = await makeTempDir();
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
        await Promise.all(tempDirs.splice(0).map((dir) => removeWritable(dir)));
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

    test('uses environment overrides as effective settings', () => {
        process.env.TAVERN_MERCHBASE_ENABLED = 'true';
        process.env.TAVERN_MERCHBASE_API_KEY = 'env-key';
        process.env.TAVERN_MERCHBASE_BASE_URL = 'https://env.merchbase.test';
        process.env.TAVERN_MERCHBASE_DEFAULT_ACCOUNT = 'acct_env';
        process.env.TAVERN_MERCHBASE_DEFAULT_MARKETPLACE = 'UK';

        expect(getMerchbaseSettings()).toMatchObject({
            apiKeyConfigured: true,
            baseUrl: 'https://env.merchbase.test',
            defaultAccount: 'acct_env',
            defaultMarketplace: 'UK',
            enabled: true,
            enablementSource: 'environment',
        });
        expect(getMerchbasePlugin()).toMatchObject({
            config: {
                baseUrl: 'https://env.merchbase.test',
                defaultAccount: 'acct_env',
                defaultMarketplace: 'UK',
            },
            enabled: true,
            secrets: [{ hasValue: true, name: 'apiKey' }],
        });
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

    test('replaces a user-owned merchbase skill when enabling the Plugin', async () => {
        const hermesHome = await makeTempDir();
        const skillPath = path.join(hermesHome, 'skills', 'merchbase');
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(
            path.join(skillPath, 'SKILL.md'),
            '---\nname: merchbase\n---\n\nUser owned instructions.\n'
        );

        await expect(ensureMerchbaseSkillForEnablement({ hermesHome })).resolves.toBeUndefined();
        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'Managed by Tavern Runtime'
        );
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

async function makeTempDir() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'merchbase-plugin-'));
    tempDirs.push(directory);
    return directory;
}

async function removeWritable(filePath: string) {
    await makeWritable(filePath);
    await fs.rm(filePath, { force: true, recursive: true });
}

async function makeWritable(filePath: string) {
    const stats = await fs.lstat(filePath).catch(() => null);
    if (!stats || stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        await fs.chmod(filePath, 0o700).catch(() => undefined);
        await Promise.all(
            (await fs.readdir(filePath)).map((entry) => makeWritable(path.join(filePath, entry)))
        );
        return;
    }

    await fs.chmod(filePath, 0o600).catch(() => undefined);
}
