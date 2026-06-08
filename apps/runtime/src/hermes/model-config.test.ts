import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { syncHermesCodexAuth } from './auth-store';
import { mergeHermesConfigFile, mergeHermesEnvFile } from './model-config';

describe('managed Hermes model config', () => {
    it('preserves existing config while setting the main model route', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-config-'));
        const configPath = path.join(directory, 'config.yaml');
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

        await mergeHermesConfigFile(configPath, {
            apiKey: null,
            baseUrl: null,
            model: 'gpt-5.4-mini',
            openAiApiKey: null,
            openRouterApiKey: null,
            provider: 'openai-codex',
        });

        const doc = parseDocument(await fs.readFile(configPath, 'utf8'));
        expect(doc.getIn(['gateway', 'bind'])).toBe('loopback');
        expect(doc.getIn(['model', 'default'])).toBe('gpt-5.4-mini');
        expect(doc.getIn(['model', 'provider'])).toBe('openai-codex');
        expect(doc.getIn(['model', 'base_url'])).toBeUndefined();
        expect(doc.getIn(['model', 'api_key'])).toBeUndefined();
    });

    it('writes a custom provider base URL for local Hermes e2e runs', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-config-'));
        const configPath = path.join(directory, 'config.yaml');

        await mergeHermesConfigFile(configPath, {
            apiKey: 'tavern-e2e-mock-key',
            baseUrl: 'http://127.0.0.1:44080/v1',
            model: 'tavern-e2e-tools',
            openAiApiKey: null,
            openRouterApiKey: null,
            provider: 'custom',
        });

        const doc = parseDocument(await fs.readFile(configPath, 'utf8'));
        expect(doc.getIn(['model', 'default'])).toBe('tavern-e2e-tools');
        expect(doc.getIn(['model', 'provider'])).toBe('custom');
        expect(doc.getIn(['model', 'base_url'])).toBe('http://127.0.0.1:44080/v1');
        expect(doc.getIn(['model', 'api_key'])).toBe('tavern-e2e-mock-key');
    });

    it('clears stale provider keys from the managed Hermes env file', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-env-'));
        const envPath = path.join(directory, '.env');
        await fs.writeFile(
            envPath,
            [
                'OPENAI_API_KEY="old-openai"',
                'OPENROUTER_API_KEY="old-openrouter"',
                'KEEP_ME="still-here"',
                '',
            ].join('\n')
        );

        await mergeHermesEnvFile(envPath, {
            apiKey: null,
            baseUrl: null,
            model: 'gpt-5.4-mini',
            openAiApiKey: null,
            openRouterApiKey: 'new-openrouter',
            provider: 'openrouter',
        });

        const env = await fs.readFile(envPath, 'utf8');
        expect(env).not.toContain('OPENAI_API_KEY');
        expect(env).toContain('OPENROUTER_API_KEY="new-openrouter"');
        expect(env).toContain('KEEP_ME="still-here"');
    });

    it('removes the managed Hermes env file when no entries remain', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-env-'));
        const envPath = path.join(directory, '.env');
        await fs.writeFile(envPath, 'OPENAI_API_KEY="old-openai"\n');

        await mergeHermesEnvFile(envPath, {
            apiKey: null,
            baseUrl: null,
            model: 'gpt-5.4-mini',
            openAiApiKey: null,
            openRouterApiKey: null,
            provider: 'openai-codex',
        });

        await expect(fs.stat(envPath)).rejects.toThrow();
    });

    it('writes Codex OAuth credentials into the Hermes auth store', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-auth-'));
        const authPath = path.join(directory, 'auth.json');
        await fs.writeFile(
            authPath,
            JSON.stringify({
                credential_pool: { keep: true },
                providers: {
                    nous: { token: 'kept' },
                },
                version: 1,
            })
        );

        await syncHermesCodexAuth(authPath, {
            credentials: {
                accessToken: 'access-token',
                accountId: 'account-1',
                lastRefresh: '2026-06-08T12:00:00.000Z',
                refreshToken: 'refresh-token',
            },
            document: {},
            path: '/Users/me/.codex/auth.json',
            source: 'file',
        });

        const auth = JSON.parse(await fs.readFile(authPath, 'utf8'));
        expect(auth.credential_pool).toEqual({ keep: true });
        expect(auth.providers.nous).toEqual({ token: 'kept' });
        expect(auth.providers['openai-codex']).toMatchObject({
            auth_mode: 'chatgpt',
            last_refresh: '2026-06-08T12:00:00.000Z',
            tokens: {
                access_token: 'access-token',
                account_id: 'account-1',
                refresh_token: 'refresh-token',
            },
        });
    });
});
