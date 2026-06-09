import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeModels from '../agent-runtime/models.ts';
import { listModelInventory } from './inventory-service.ts';

afterEach(() => {
    mock.restore();
});

test('listModelInventory lists Hermes providers and hides models from disconnected providers', async () => {
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        apiKeyOptions: [],
        models: [
            {
                id: 'openai-codex/gpt-5.5',
                label: 'GPT-5.5',
                provider: 'openai-codex',
            },
            {
                id: 'anthropic/claude-sonnet-4-6',
                label: 'Claude Sonnet 4.6',
                provider: 'anthropic',
            },
        ],
        providers: [
            {
                authenticated: true,
                authType: 'oauth_external',
                id: 'openai-codex',
                keyEnv: null,
                label: 'OpenAI Codex',
                modelCount: 1,
                oauthFlow: 'device_code',
                warning: null,
            },
            {
                authenticated: false,
                authType: 'api_key',
                id: 'anthropic',
                keyEnv: null,
                label: 'Anthropic',
                modelCount: 0,
                oauthFlow: null,
                warning: 'paste ANTHROPIC_API_KEY to activate',
            },
        ],
        updatedAt: '2026-06-08T12:00:00.000Z',
    }));

    const inventory = await listModelInventory();
    const codex = inventory.providers.find((provider) => provider.provider === 'openai-codex');
    const anthropic = inventory.providers.find((provider) => provider.provider === 'anthropic');

    assert.equal(codex?.isConnected, true);
    assert.equal(codex?.models.length, 1);
    assert.equal(anthropic?.isConnected, false);
    assert.equal(anthropic?.authAction, 'api-key');
    assert.equal(anthropic?.keyEnv, 'ANTHROPIC_API_KEY');
    assert.equal(anthropic?.models.length, 0);
});

test('listModelInventory keeps provider rows direct and passes through Hermes api-key options', async () => {
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        apiKeyOptions: [
            {
                description: 'OpenRouter API key',
                docsUrl: 'https://openrouter.ai/keys',
                envKey: 'OPENROUTER_API_KEY',
                isSet: false,
                label: 'OpenRouter',
                providerHint: 'openrouter',
            },
        ],
        models: [],
        providers: [
            {
                authenticated: false,
                authType: 'api_key',
                id: 'openrouter',
                keyEnv: null,
                label: 'OpenRouter',
                modelCount: 0,
                oauthFlow: null,
                warning: 'run `hermes model` to configure (api_key)',
            },
        ],
        updatedAt: '2026-06-08T12:00:00.000Z',
    }));

    const inventory = await listModelInventory();
    const openRouter = inventory.providers.find((provider) => provider.provider === 'openrouter');

    assert.equal(openRouter?.authAction, null);
    assert.equal(openRouter?.keyEnv, null);
    assert.equal(inventory.apiKeyOptions[0]?.envKey, 'OPENROUTER_API_KEY');
});

test('listModelInventory treats external OAuth providers as manual setup', async () => {
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        apiKeyOptions: [],
        models: [],
        providers: [
            {
                authenticated: false,
                authType: 'oauth_external',
                id: 'qwen-oauth',
                keyEnv: null,
                label: 'Qwen OAuth',
                modelCount: 0,
                oauthFlow: 'external',
                warning: 'run `hermes model` to configure (oauth_external)',
            },
            {
                authenticated: false,
                authType: 'oauth_external',
                id: 'xai-oauth',
                keyEnv: null,
                label: 'xAI OAuth',
                modelCount: 0,
                oauthFlow: 'loopback',
                warning: 'run `hermes model` to configure (oauth_external)',
            },
        ],
        updatedAt: '2026-06-08T12:00:00.000Z',
    }));

    const inventory = await listModelInventory();
    const qwen = inventory.providers.find((provider) => provider.provider === 'qwen-oauth');
    const xai = inventory.providers.find((provider) => provider.provider === 'xai-oauth');

    assert.equal(qwen?.authAction, 'external');
    assert.equal(xai?.authAction, 'oauth');
});

test('listModelInventory prefers Hermes OAuth over api-key setup when both are available', async () => {
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        apiKeyOptions: [],
        models: [],
        providers: [
            {
                authenticated: false,
                authType: 'api_key',
                id: 'anthropic',
                keyEnv: 'ANTHROPIC_API_KEY',
                label: 'Anthropic',
                modelCount: 0,
                oauthFlow: 'pkce',
                warning: 'paste ANTHROPIC_API_KEY to activate',
            },
        ],
        updatedAt: '2026-06-08T12:00:00.000Z',
    }));

    const inventory = await listModelInventory();
    const anthropic = inventory.providers.find((provider) => provider.provider === 'anthropic');

    assert.equal(anthropic?.authAction, 'oauth');
    assert.equal(anthropic?.keyEnv, 'ANTHROPIC_API_KEY');
});
