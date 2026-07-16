import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { saveClaudeOAuthCredentials } from '../model-access/claude-settings.ts';
import { saveOpenAiSettings } from '../model-access/openai-settings.ts';
import { listAgentModels } from './catalog-service.ts';
import { resolveClaudeModelCatalog } from './provider-sources/claude.ts';
import { resolveCodexModelCatalog } from './provider-sources/codex.ts';
import { resolveOpenAiModelCatalog } from './provider-sources/openai.ts';
import { listModelProviderCatalog, setModelProviderEnabled } from './provider-store.ts';

const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
const originalCodexCommand = process.env.TAVERN_AGENT_CODEX_CLI_COMMAND;
const originalCodexHome = process.env.CODEX_HOME;
const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

beforeEach(() => {
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
    restoreEnv('TAVERN_AGENT_CODEX_CLI_COMMAND', originalCodexCommand);
    restoreEnv('CODEX_HOME', originalCodexHome);
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
        expect(result.models.every((model) => model.capability === 'agent')).toBe(true);
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
        expect(result.models).toContainEqual(
            expect.objectContaining({
                capability: 'imageGeneration',
                executionKind: 'direct',
                id: 'codex/gpt-image-2',
            })
        );
        expect(
            result.models
                .filter((model) => model.capability === 'agent')
                .every((model) => model.executionKind === 'harness')
        ).toBe(true);
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

    it('keeps disconnected OAuth providers in the provider catalog without executable models', async () => {
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = 'tavern-missing-codex';
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = 'tavern-missing-claude';
        process.env.OPENAI_API_KEY = '';

        const catalog = await listModelProviderCatalog();
        const result = await listAgentModels();
        const claude = catalog.providers.find((provider) => provider.id === 'claude');

        expect(claude).toMatchObject({
            // Claude access is credential-driven now: no stored sign-in or
            // API key means needs-auth, regardless of CLI presence.
            accessState: 'needs-auth',
            enabled: false,
        });
        expect(result.providers.some((provider) => provider.id === 'claude')).toBe(false);
        expect(result.models.some((model) => model.provider === 'claude')).toBe(false);
    });

    it('keeps Claude authenticated and exposes curated rows when connected', async () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        process.env.OPENAI_API_KEY = '';
        saveClaudeOAuthCredentials({
            accessToken: 'sk-ant-test',
            expiresAt: null,
            refreshToken: null,
        });
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });

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

    it('keeps Codex out of executable inventory until OAuth access is ready', async () => {
        const codexHome = mkdtempSync(path.join(tmpdir(), 'tavern-codex-home-'));
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = process.execPath;
        process.env.CODEX_HOME = codexHome;
        process.env.OPENAI_API_KEY = '';
        try {
            await setModelProviderEnabled({ enabled: true, providerId: 'codex' });

            const result = await listAgentModels();
            const catalog = await listModelProviderCatalog();
            const codex = catalog.providers.find((provider) => provider.id === 'codex');

            expect(codex).toMatchObject({
                accessState: 'needs-auth',
                enabled: true,
            });
            expect(result.models.some((model) => model.provider === 'codex')).toBe(false);
        } finally {
            rmSync(codexHome, { force: true, recursive: true });
        }
    });

    it('exposes provider auth facts on model records', async () => {
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = process.execPath;
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = 'tavern-missing-claude';
        process.env.OPENAI_API_KEY = 'test-key';
        await setModelProviderEnabled({ enabled: true, providerId: 'openai' });
        globalThis.fetch = vi.fn(async () => ({
            json: async () => ({ data: [{ id: 'gpt-4.1-mini' }] }),
            ok: true,
            status: 200,
            statusText: 'OK',
        })) as unknown as typeof globalThis.fetch;

        const result = await listAgentModels();
        const openai = result.models.find((model) => model.id === 'openai/gpt-4.1-mini');

        expect(openai).toMatchObject({
            capability: 'agent',
            executionKind: 'harness',
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

    it('uses saved OpenAI API keys for executable model discovery', async () => {
        process.env.OPENAI_API_KEY = '';
        saveOpenAiSettings({ apiKey: 'sk-test-saved-openai-key-1234567890' });
        await setModelProviderEnabled({ enabled: true, providerId: 'openai' });
        const fetch = vi.fn(async () => ({
            json: async () => ({ data: [{ id: 'gpt-4.1-mini' }] }),
            ok: true,
            status: 200,
            statusText: 'OK',
        }));
        globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

        const result = await listAgentModels();

        expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
            headers: { Authorization: 'Bearer sk-test-saved-openai-key-1234567890' },
        });
        expect(result.models.map((model) => model.id)).toContain('openai/gpt-4.1-mini');
    });

    it('filters OpenAI live models through the curated capability catalog', async () => {
        const fetch = vi.fn(async () => ({
            json: async () => ({
                data: [
                    { id: 'gpt-4.1-mini' },
                    { id: 'gpt-4.1' },
                    { id: 'gpt-image-2' },
                    { id: 'gpt-image-1-mini' },
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
            'openai/gpt-image-2',
            'openai/gpt-image-1-mini',
        ]);
        expect(result.models.filter((model) => model.capability === 'imageGeneration')).toEqual([
            expect.objectContaining({
                executionKind: 'direct',
                id: 'openai/gpt-image-2',
            }),
            expect.objectContaining({
                executionKind: 'direct',
                id: 'openai/gpt-image-1-mini',
            }),
        ]);
        expect(
            result.models
                .filter((model) => model.capability === 'agent')
                .every((model) => model.executionKind === 'harness')
        ).toBe(true);
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
        expect(result.models).toContainEqual(
            expect.objectContaining({
                capability: 'imageGeneration',
                executionKind: 'direct',
                id: 'openai/gpt-image-2',
            })
        );
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}
