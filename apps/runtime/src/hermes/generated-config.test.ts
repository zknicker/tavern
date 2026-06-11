import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { mergeHermesGeneratedConfig } from './generated-config';

const emptyExecution = { fallbackModels: [], timezone: null };
const codexModel = {
    apiKey: null,
    baseUrl: null,
    model: 'gpt-5.4-mini',
    provider: 'openai-codex',
};

async function tempConfigPath() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-config-'));
    return path.join(directory, 'config.yaml');
}

async function readConfig(configPath: string) {
    return parseDocument(await fs.readFile(configPath, 'utf8'));
}

describe('generated Hermes config composer', () => {
    it('produces the exact generated document from an empty file', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            execution: {
                fallbackModels: [
                    { model: 'kimi-k2.5', provider: 'openrouter' },
                    { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
                ],
                timezone: 'America/New_York',
            },
            model: codexModel,
        });

        expect((await readConfig(configPath)).toJS()).toEqual({
            fallback_providers: [
                { model: 'kimi-k2.5', provider: 'openrouter' },
                { base_url: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
            ],
            memory: {
                memory_enabled: false,
                provider: 'mnemosyne',
                user_profile_enabled: false,
            },
            model: {
                default: 'gpt-5.4-mini',
                provider: 'openai-codex',
            },
            plugins: {
                enabled: ['tavern-messenger-platform'],
            },
            timezone: 'America/New_York',
        });
    });

    it('preserves operator-managed keys while setting the model route', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            [
                'gateway:',
                '  bind: loopback',
                'model:',
                '  default: old-model',
                '  provider: old-provider',
                '',
            ].join('\n')
        );

        await mergeHermesGeneratedConfig(configPath, {
            execution: emptyExecution,
            model: codexModel,
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['gateway', 'bind'])).toBe('loopback');
        expect(doc.getIn(['model', 'default'])).toBe('gpt-5.4-mini');
        expect(doc.getIn(['model', 'provider'])).toBe('openai-codex');
        expect(doc.getIn(['model', 'base_url'])).toBeUndefined();
        expect(doc.getIn(['model', 'api_key'])).toBeUndefined();
        expect(doc.getIn(['memory', 'provider'])).toBe('mnemosyne');
        expect(doc.getIn(['memory', 'memory_enabled'])).toBe(false);
        expect(doc.getIn(['memory', 'user_profile_enabled'])).toBe(false);
        expect(doc.has('fallback_providers')).toBe(false);
        expect(doc.has('timezone')).toBe(false);
    });

    it('writes a custom provider base URL for local Hermes e2e runs', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            execution: emptyExecution,
            model: {
                apiKey: 'tavern-e2e-mock-key',
                baseUrl: 'http://127.0.0.1:44080/v1',
                model: 'tavern-e2e-tools',
                provider: 'custom',
            },
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['model', 'default'])).toBe('tavern-e2e-tools');
        expect(doc.getIn(['model', 'provider'])).toBe('custom');
        expect(doc.getIn(['model', 'base_url'])).toBe('http://127.0.0.1:44080/v1');
        expect(doc.getIn(['model', 'api_key'])).toBe('tavern-e2e-mock-key');
    });

    it('removes execution keys when fallbacks and timezone are cleared', async () => {
        const configPath = await tempConfigPath();
        await mergeHermesGeneratedConfig(configPath, {
            execution: {
                fallbackModels: [{ model: 'kimi-k2.5', provider: 'openrouter' }],
                timezone: 'Europe/Berlin',
            },
            model: codexModel,
        });

        await mergeHermesGeneratedConfig(configPath, {
            execution: emptyExecution,
            model: codexModel,
        });

        const doc = await readConfig(configPath);
        expect(doc.has('fallback_providers')).toBe(false);
        expect(doc.has('timezone')).toBe(false);
    });

    it('keeps an existing plugins list and appends the messenger plugin once', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            ['plugins:', '  enabled:', '    - custom-plugin', ''].join('\n')
        );

        await mergeHermesGeneratedConfig(configPath, {
            execution: emptyExecution,
            model: codexModel,
        });
        await mergeHermesGeneratedConfig(configPath, {
            execution: emptyExecution,
            model: codexModel,
        });

        const config = (await readConfig(configPath)).toJS() as {
            plugins: { enabled: string[] };
        };
        expect(config.plugins.enabled).toEqual(['custom-plugin', 'tavern-messenger-platform']);
    });
});
