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

    test('defaults to inherit-everything settings', () => {
        expect(getHermesExecutionSettings()).toEqual({
            compression: null,
            fallbackModels: [],
            subagentEffort: null,
            subagentModel: null,
            timezone: null,
            updatedAt: null,
            webExtractSummarizer: null,
        });
    });

    test('persists subagent defaults and compression and writes engine keys', async () => {
        await putSettings({
            compression: { enabled: true, protectLastMessages: 40, thresholdPercent: 60 },
            subagentEffort: 'medium',
            subagentModel: { model: 'claude-haiku-4-5', provider: 'anthropic' },
        });

        expect(getHermesExecutionSettings()).toMatchObject({
            compression: { enabled: true, protectLastMessages: 40, thresholdPercent: 60 },
            subagentEffort: 'medium',
            subagentModel: { model: 'claude-haiku-4-5', provider: 'anthropic' },
        });

        const config = await fs.readFile(path.join(tempHermesHome, 'config.yaml'), 'utf8');
        expect(config).toContain('reasoning_effort: medium');
        expect(config).toContain('threshold: 0.6');

        await putSettings({ compression: null, subagentEffort: null, subagentModel: null });
        expect(getHermesExecutionSettings()).toMatchObject({
            compression: null,
            subagentEffort: null,
            subagentModel: null,
        });
    });

    test('persists the web_extract summarizer and writes auxiliary engine keys', async () => {
        await putSettings({
            webExtractSummarizer: {
                model: 'google/gemini-3-flash-preview',
                provider: 'openrouter',
                timeoutSeconds: 360,
            },
        });

        expect(getHermesExecutionSettings()).toMatchObject({
            webExtractSummarizer: {
                model: 'google/gemini-3-flash-preview',
                provider: 'openrouter',
                timeoutSeconds: 360,
            },
        });

        const config = await fs.readFile(path.join(tempHermesHome, 'config.yaml'), 'utf8');
        expect(config).toContain('auxiliary:');
        expect(config).toContain('web_extract:');
        expect(config).toContain('provider: openrouter');
        expect(config).toContain('model: google/gemini-3-flash-preview');
        expect(config).toContain('timeout: 360');

        await putSettings({ webExtractSummarizer: null });
        expect(getHermesExecutionSettings().webExtractSummarizer).toBeNull();
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
