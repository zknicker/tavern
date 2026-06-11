import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const tempHermesHome = await vi.hoisted(async () => {
    const [{ mkdtempSync }, { tmpdir }, { join }] = await Promise.all([
        import('node:fs'),
        import('node:os'),
        import('node:path'),
    ]);
    const home = mkdtempSync(join(tmpdir(), 'tavern-hermes-home-'));
    process.env.TAVERN_HERMES_HOME = home;
    return home;
});

import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { getHermesExecutionSettings, handleExecutionSettingsRequest } from './execution-settings';

describe('agent execution settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(path.join(tempHermesHome, 'config.yaml'), { force: true });
    });

    test('defaults to no fallbacks and system timezone', () => {
        expect(getHermesExecutionSettings()).toEqual({
            fallbackModels: [],
            timezone: null,
            updatedAt: null,
        });
    });

    test('GET returns stored settings', async () => {
        await putSettings({
            fallbackModels: [{ model: 'kimi-k2.5', provider: 'openrouter' }],
            timezone: 'America/New_York',
        });

        const response = await handleExecutionSettingsRequest(
            new Request('http://runtime.test/execution-settings')
        );
        const body = (await response?.json()) as Record<string, unknown>;

        expect(response?.status).toBe(200);
        expect(body.fallbackModels).toEqual([{ model: 'kimi-k2.5', provider: 'openrouter' }]);
        expect(body.timezone).toBe('America/New_York');
        expect(typeof body.updatedAt).toBe('string');
    });

    test('PUT persists settings and rewrites the generated config file', async () => {
        const response = await putSettings({
            fallbackModels: [
                { model: 'kimi-k2.5', provider: 'openrouter' },
                { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
            ],
            timezone: 'Europe/Berlin',
        });
        const body = (await response?.json()) as Record<string, unknown>;

        expect(response?.status).toBe(200);
        expect(body.restartScheduled).toBe(false);
        expect(getHermesExecutionSettings()).toMatchObject({
            fallbackModels: [
                { model: 'kimi-k2.5', provider: 'openrouter' },
                { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
            ],
            timezone: 'Europe/Berlin',
        });

        const config = await fs.readFile(path.join(tempHermesHome, 'config.yaml'), 'utf8');
        expect(config).toContain('fallback_providers:');
        expect(config).toContain('provider: openrouter');
        expect(config).toContain('base_url: http://127.0.0.1:1234/v1');
        expect(config).toContain('timezone: Europe/Berlin');
    });

    test('PUT merges partial updates with stored settings', async () => {
        await putSettings({
            fallbackModels: [{ model: 'kimi-k2.5', provider: 'openrouter' }],
            timezone: 'Europe/Berlin',
        });

        await putSettings({ timezone: null });
        expect(getHermesExecutionSettings()).toMatchObject({
            fallbackModels: [{ model: 'kimi-k2.5', provider: 'openrouter' }],
            timezone: null,
        });

        await putSettings({ fallbackModels: [] });
        expect(getHermesExecutionSettings()).toMatchObject({
            fallbackModels: [],
            timezone: null,
        });
    });

    test('PUT rejects an invalid timezone', async () => {
        const response = await putSettings({ timezone: 'Not/AZone' });

        expect(response?.status).toBe(400);
        expect(getHermesExecutionSettings().timezone).toBeNull();
    });

    test('ignores requests for other routes', async () => {
        const response = await handleExecutionSettingsRequest(
            new Request('http://runtime.test/health')
        );

        expect(response).toBeNull();
    });
});

async function putSettings(body: unknown) {
    return await handleExecutionSettingsRequest(
        new Request('http://runtime.test/execution-settings', {
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
        })
    );
}
