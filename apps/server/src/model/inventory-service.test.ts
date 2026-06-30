import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeModels from '../agent-runtime/models.ts';
import { listModelInventory } from './inventory-service.ts';

afterEach(() => {
    mock.restore();
});

test('listModelInventory lists agent providers and keeps curated models for disconnected providers', async () => {
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        apiKeyOptions: [],
        models: [
            {
                availability: 'available',
                executionKind: 'harness',
                id: 'codex/gpt-5.5',
                label: 'GPT-5.5',
                metadata: {},
                provider: 'codex',
                route: { baseUrl: null, model: 'gpt-5.5', provider: 'codex' },
                sourceKind: 'curated',
            },
            {
                availability: 'available',
                executionKind: 'harness',
                id: 'codex/gpt-5.4',
                label: 'GPT-5.4',
                metadata: {},
                provider: 'codex',
                route: { baseUrl: null, model: 'gpt-5.4', provider: 'codex' },
                sourceKind: 'curated',
            },
            {
                availability: 'available',
                executionKind: 'harness',
                id: 'claude/claude-sonnet-4-6',
                label: 'Claude Sonnet 4.6',
                metadata: {},
                provider: 'claude',
                route: { baseUrl: null, model: 'claude-sonnet-4-6', provider: 'claude' },
                sourceKind: 'curated',
            },
        ],
        providers: [
            {
                authenticated: true,
                authType: 'oauth_external',
                id: 'codex',
                keyEnv: null,
                label: 'Codex',
                modelCount: 2,
                oauthFlow: 'external',
                warning: null,
            },
            {
                authenticated: false,
                authType: 'oauth_external',
                id: 'claude',
                keyEnv: null,
                label: 'Claude Code',
                modelCount: 1,
                oauthFlow: 'external',
                warning: 'claude is not installed',
            },
        ],
        updatedAt: '2026-06-08T12:00:00.000Z',
    }));

    const inventory = await listModelInventory();
    const codex = inventory.providers.find((provider) => provider.provider === 'codex');
    const claude = inventory.providers.find((provider) => provider.provider === 'claude');

    assert.equal(codex?.isConnected, true);
    assert.deepEqual(
        codex?.models.map((model) => model.ref),
        ['codex/gpt-5.4', 'codex/gpt-5.5']
    );
    assert.equal(claude?.isConnected, false);
    assert.deepEqual(
        claude?.models.map((model) => model.ref),
        ['claude/claude-sonnet-4-6']
    );
});

test('listModelInventory keeps provider rows direct and passes through api-key options', async () => {
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
                warning: 'configure the provider API key to activate',
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
                warning: 'configure the provider OAuth session to activate',
            },
            {
                authenticated: false,
                authType: 'oauth_external',
                id: 'xai-oauth',
                keyEnv: null,
                label: 'xAI OAuth',
                modelCount: 0,
                oauthFlow: 'loopback',
                warning: 'configure the provider OAuth session to activate',
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

test('listModelInventory prefers OAuth over api-key setup when both are available', async () => {
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
