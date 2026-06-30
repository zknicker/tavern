import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { listAgentModels } from './catalog-service.ts';
import { resolveClaudeModelCatalog } from './provider-sources/claude.ts';
import { resolveCodexModelCatalog } from './provider-sources/codex.ts';
import { resolveOpenAiModelCatalog } from './provider-sources/openai.ts';

const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
const originalCodexCommand = process.env.TAVERN_AGENT_CODEX_CLI_COMMAND;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

beforeEach(() => {
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
    restoreEnv('TAVERN_AGENT_CODEX_CLI_COMMAND', originalCodexCommand);
    restoreEnv('OPENAI_API_KEY', originalOpenAiApiKey);
    globalThis.fetch = originalFetch;
    closeDb();
});

describe('Agent engine model catalog', () => {
    it('exposes curated Claude Code models when the provider CLI is available', () => {
        const result = resolveClaudeModelCatalog({
            command: process.execPath,
            provider: { id: 'claude', label: 'Claude Code' },
        });

        expect(result.warning).toBeNull();
        expect(result.models.map((model) => model.id)).toContain('claude/claude-opus-4-8');
        expect(result.models.map((model) => model.id)).toContain('claude/claude-sonnet-4-6');
        expect(result.models.every((model) => model.executionKind === 'harness')).toBe(true);
    });

    it('exposes curated Codex models when the provider CLI is available', () => {
        const result = resolveCodexModelCatalog({
            command: process.execPath,
            provider: { id: 'codex', label: 'Codex' },
        });

        expect(result.warning).toBeNull();
        expect(result.models.map((model) => model.id)).toContain('codex/gpt-5.5');
        expect(result.models.map((model) => model.id)).toContain('codex/gpt-5.4');
        expect(result.models.every((model) => model.executionKind === 'harness')).toBe(true);
    });

    it('keeps curated OAuth model rows unavailable when the provider CLI is missing', () => {
        const result = resolveClaudeModelCatalog({
            command: 'tavern-missing-claude',
            provider: { id: 'claude', label: 'Claude Code' },
        });

        expect(result.models.map((model) => model.id)).toContain('claude/claude-opus-4-8');
        expect(result.models.every((model) => model.availability === 'unavailable')).toBe(true);
        expect(result.warning).toContain('"tavern-missing-claude" was not found');
    });

    it('marks an OAuth provider disconnected without hiding curated models', async () => {
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = 'tavern-missing-codex';
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = 'tavern-missing-claude';
        process.env.OPENAI_API_KEY = '';

        const result = await listAgentModels();
        const claude = result.providers.find((provider) => provider.id === 'claude');

        expect(claude).toMatchObject({
            authenticated: false,
            modelCount: 6,
        });
        expect(result.models.some((model) => model.provider === 'claude')).toBe(true);
        expect(
            result.models
                .filter((model) => model.provider === 'claude')
                .every((model) => model.availability === 'unavailable')
        ).toBe(true);
    });

    it('keeps Claude authenticated and exposes curated rows when the CLI is available', async () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        process.env.OPENAI_API_KEY = '';

        const result = await listAgentModels();
        const claude = result.providers.find((provider) => provider.id === 'claude');

        expect(claude).toMatchObject({
            authenticated: true,
            modelCount: 6,
            warning: null,
        });
        expect(result.models.some((model) => model.id === 'claude/claude-opus-4-8')).toBe(true);
        expect(
            result.models
                .filter((model) => model.provider === 'claude')
                .every((model) => model.executionKind === 'harness')
        ).toBe(true);
    });

    it('keeps Codex authenticated and exposes curated rows when the CLI is available', async () => {
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = process.execPath;
        process.env.OPENAI_API_KEY = '';

        const result = await listAgentModels();
        const codex = result.providers.find((provider) => provider.id === 'codex');

        expect(codex).toMatchObject({
            authenticated: true,
            modelCount: 5,
            warning: null,
        });
        expect(result.models.some((model) => model.id === 'codex/gpt-5.5')).toBe(true);
        expect(
            result.models
                .filter((model) => model.provider === 'codex')
                .every((model) => model.executionKind === 'harness')
        ).toBe(true);
    });

    it('exposes provider auth facts on model records', async () => {
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = process.execPath;
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = 'tavern-missing-claude';
        process.env.OPENAI_API_KEY = 'test-key';
        globalThis.fetch = vi.fn(async () => ({
            json: async () => ({ data: [{ id: 'gpt-4.1-mini' }] }),
            ok: true,
            status: 200,
            statusText: 'OK',
        })) as unknown as typeof globalThis.fetch;

        const result = await listAgentModels();
        const openai = result.models.find((model) => model.id === 'openai/gpt-4.1-mini');

        expect(openai).toMatchObject({
            executionKind: 'language-model',
            metadata: {
                authType: 'api_key',
                keyEnv: 'OPENAI_API_KEY',
                oauthFlow: null,
                providerId: 'openai',
            },
            route: {
                baseUrl: null,
                model: 'gpt-4.1-mini',
                provider: 'openai',
            },
        });
    });

    it('filters OpenAI live models through the curated agent catalog', async () => {
        const fetch = vi.fn(async () => ({
            json: async () => ({
                data: [
                    { id: 'gpt-4.1-mini' },
                    { id: 'gpt-4.1' },
                    { id: 'text-embedding-3-large' },
                    { id: 'whisper-1' },
                ],
            }),
            ok: true,
            status: 200,
            statusText: 'OK',
        }));
        globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

        const result = await resolveOpenAiModelCatalog({
            apiKey: 'test-key',
            provider: { id: 'openai', label: 'OpenAI' },
        });

        expect(result.warning).toBeNull();
        expect(result.models.map((model) => model.id)).toEqual([
            'openai/gpt-4.1',
            'openai/gpt-4.1-mini',
        ]);
        expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
            headers: { Authorization: 'Bearer test-key' },
        });
    });

    it('uses cached OpenAI discovery after the first successful live read', async () => {
        const fetch = vi.fn(async () => ({
            json: async () => ({
                data: [{ id: 'gpt-4.1-mini' }],
            }),
            ok: true,
            status: 200,
            statusText: 'OK',
        }));
        globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

        await resolveOpenAiModelCatalog({
            apiKey: 'test-key',
            provider: { id: 'openai', label: 'OpenAI' },
        });
        const cached = await resolveOpenAiModelCatalog({
            apiKey: 'test-key',
            provider: { id: 'openai', label: 'OpenAI' },
        });

        expect(fetch).toHaveBeenCalledOnce();
        expect(cached.models.map((model) => model.id)).toEqual(['openai/gpt-4.1-mini']);
    });

    it('surfaces a warning and curated OpenAI rows when OpenAI discovery fails', async () => {
        globalThis.fetch = vi.fn(
            async () =>
                ({
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                }) as Response
        ) as unknown as typeof globalThis.fetch;

        const result = await resolveOpenAiModelCatalog({
            apiKey: 'bad-key',
            provider: { id: 'openai', label: 'OpenAI' },
        });

        expect(result.warning).toContain('OpenAI model discovery failed: 401 Unauthorized');
        expect(result.models.map((model) => model.id)).toContain('openai/gpt-4.1-mini');
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}
