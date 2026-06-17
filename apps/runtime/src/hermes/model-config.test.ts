import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncHermesCodexAuth } from './auth-store';
import { ensureManagedMnemosynePlugin } from './mnemosyne';
import {
    applySavedAgentModelRoute,
    managedMnemosyneEnv,
    mergeHermesEnvFile,
    resolveManagedHermesModelRoute,
} from './model-config';

const codexEnvConfig = {
    apiKey: null,
    baseUrl: null,
    model: 'gpt-5.4-mini',
    openAiApiKey: null,
    openRouterApiKey: null,
    provider: 'openai-codex',
};

describe('managed Hermes model config', () => {
    it('materializes the managed Mnemosyne provider shim', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-mnemosyne-'));

        const integration = await ensureManagedMnemosynePlugin({ hermesHome: directory });

        expect(integration.managed).toBe(true);
        await expect(
            fs.readFile(path.join(integration.pluginPath, '__init__.py'), 'utf8')
        ).resolves.toContain('MnemosyneMemoryProvider');
        await expect(
            fs.readFile(path.join(integration.pluginPath, 'plugin.yaml'), 'utf8')
        ).resolves.toContain('mnemosyne-hermes');
    });

    it('preserves an existing unmanaged Mnemosyne plugin', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-mnemosyne-'));
        const pluginPath = path.join(directory, 'plugins', 'mnemosyne');
        await fs.mkdir(pluginPath, { recursive: true });
        await fs.writeFile(path.join(pluginPath, '__init__.py'), 'custom plugin');

        const integration = await ensureManagedMnemosynePlugin({ hermesHome: directory });

        expect(integration.managed).toBe(false);
        await expect(fs.readFile(path.join(pluginPath, '__init__.py'), 'utf8')).resolves.toBe(
            'custom plugin'
        );
    });

    it('preserves provider keys already saved in the managed Hermes env file', async () => {
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
            config: {
                ...codexEnvConfig,
                openRouterApiKey: 'new-openrouter',
                provider: 'openrouter',
            },
        });

        const env = await fs.readFile(envPath, 'utf8');
        expect(env).toContain('OPENAI_API_KEY="old-openai"');
        expect(env).toContain('OPENROUTER_API_KEY="new-openrouter"');
        expect(env).toContain('KEEP_ME="still-here"');
    });

    it('writes managed Mnemosyne host LLM env without provider keys', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-env-'));
        const envPath = path.join(directory, '.env');

        await mergeHermesEnvFile(envPath, { config: codexEnvConfig });

        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain(
            `MNEMOSYNE_HOST_LLM_ENABLED="${managedMnemosyneEnv.MNEMOSYNE_HOST_LLM_ENABLED}"`
        );
    });

    it('writes managed agent env vars and clears stale managed names only', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-env-'));
        const envPath = path.join(directory, '.env');
        await fs.writeFile(
            envPath,
            [
                'OLD_AGENT_SECRET="old"',
                'KEEP_ME="still-here"',
                'TAVERN_MCP_OLD_ENV_TOKEN="stale-connector"',
                '',
            ].join('\n')
        );

        await mergeHermesEnvFile(envPath, {
            agentEnvEntries: new Map([['NEW_AGENT_SECRET', 'new']]),
            agentEnvStaleNames: ['OLD_AGENT_SECRET'],
            config: codexEnvConfig,
            connectorEnvEntries: new Map([['TAVERN_MCP_NEW_ENV_TOKEN', 'connector']]),
        });

        const env = await fs.readFile(envPath, 'utf8');
        expect(env).not.toContain('OLD_AGENT_SECRET');
        expect(env).not.toContain('TAVERN_MCP_OLD_ENV_TOKEN');
        expect(env).toContain('NEW_AGENT_SECRET="new"');
        expect(env).toContain('KEEP_ME="still-here"');
        expect(env).toContain('TAVERN_MCP_NEW_ENV_TOKEN="connector"');
    });

    it('uses Codex OAuth only when credentials are available', () => {
        expect(
            resolveManagedHermesModelRoute({
                codexCredentialsAvailable: true,
                codexModel: null,
                explicitApiKey: null,
                explicitBaseUrl: null,
                explicitModel: null,
                explicitProvider: null,
                openAiApiKey: null,
                openRouterApiKey: null,
            })
        ).toMatchObject({
            model: 'gpt-5.4-mini',
            provider: 'openai-codex',
        });

        expect(
            resolveManagedHermesModelRoute({
                codexCredentialsAvailable: false,
                codexModel: null,
                explicitApiKey: null,
                explicitBaseUrl: null,
                explicitModel: null,
                explicitProvider: null,
                openAiApiKey: null,
                openRouterApiKey: null,
            })
        ).toMatchObject({
            model: null,
            provider: null,
        });
    });

    it('keeps the saved agent model instead of falling back to the credential default', () => {
        expect(
            applySavedAgentModelRoute({
                config: codexEnvConfig,
                explicitModel: null,
                explicitProvider: null,
                savedModel: {
                    model: 'gpt-5.5',
                    provider: 'openai-codex',
                },
                savedModelLegacy: false,
            })
        ).toMatchObject({
            model: 'gpt-5.5',
            provider: 'openai-codex',
        });
    });

    it('leaves an explicit env model route in control', () => {
        expect(
            applySavedAgentModelRoute({
                config: {
                    ...codexEnvConfig,
                    model: 'gpt-5.4-mini',
                    provider: 'openai-codex',
                },
                explicitModel: 'gpt-5.4-mini',
                explicitProvider: 'openai-codex',
                savedModel: {
                    model: 'gpt-5.5',
                    provider: 'openai-codex',
                },
                savedModelLegacy: false,
            })
        ).toMatchObject({
            model: 'gpt-5.4-mini',
            provider: 'openai-codex',
        });
    });

    it('keeps same-provider base URL but does not leak it across providers', () => {
        const openAiRoute = {
            ...codexEnvConfig,
            baseUrl: 'https://api.openai.com/v1',
            provider: 'openai',
        };

        expect(
            applySavedAgentModelRoute({
                config: openAiRoute,
                explicitModel: null,
                explicitProvider: null,
                savedModel: { model: 'gpt-5.5', provider: 'openai' },
                savedModelLegacy: false,
            }).baseUrl
        ).toBe('https://api.openai.com/v1');

        expect(
            applySavedAgentModelRoute({
                config: openAiRoute,
                explicitModel: null,
                explicitProvider: null,
                savedModel: { model: 'kimi-k2.5', provider: 'openrouter' },
                savedModelLegacy: false,
            }).baseUrl
        ).toBeNull();
    });

    it('does not treat legacy state matching the Tavern default as a user override', () => {
        expect(
            applySavedAgentModelRoute({
                config: codexEnvConfig,
                explicitModel: null,
                explicitProvider: null,
                savedModel: {
                    model: 'gpt-5.4-mini',
                    provider: 'openai-codex',
                },
                savedModelLegacy: true,
            })
        ).toBe(codexEnvConfig);
    });

    it('keeps a legacy non-default model as a likely user override', () => {
        expect(
            applySavedAgentModelRoute({
                config: codexEnvConfig,
                explicitModel: null,
                explicitProvider: null,
                savedModel: {
                    model: 'gpt-5.5',
                    provider: 'openai-codex',
                },
                savedModelLegacy: true,
            })
        ).toMatchObject({
            model: 'gpt-5.5',
            provider: 'openai-codex',
        });
    });

    it('prefers direct OpenAI API before OpenRouter when Codex OAuth is absent', () => {
        expect(
            resolveManagedHermesModelRoute({
                codexCredentialsAvailable: false,
                codexModel: null,
                explicitApiKey: null,
                explicitBaseUrl: null,
                explicitModel: null,
                explicitProvider: null,
                openAiApiKey: 'sk-openai',
                openRouterApiKey: 'sk-or-openrouter',
            })
        ).toMatchObject({
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5.4-mini',
            provider: 'openai',
        });
    });

    it('uses OpenRouter when it is the only configured provider', () => {
        expect(
            resolveManagedHermesModelRoute({
                codexCredentialsAvailable: false,
                codexModel: null,
                explicitApiKey: null,
                explicitBaseUrl: null,
                explicitModel: null,
                explicitProvider: null,
                openAiApiKey: null,
                openRouterApiKey: 'sk-or-openrouter',
            })
        ).toMatchObject({
            model: 'moonshotai/kimi-k2.5',
            provider: 'openrouter',
        });
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
