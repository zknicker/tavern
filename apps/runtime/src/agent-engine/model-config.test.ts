import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';

const originalEnv = {
    TAVERN_AGENT_PROVIDER: process.env.TAVERN_AGENT_PROVIDER,
    TAVERN_AGENT_MODEL: process.env.TAVERN_AGENT_MODEL,
};

beforeEach(() => {
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    restoreEnv('TAVERN_AGENT_PROVIDER', originalEnv.TAVERN_AGENT_PROVIDER);
    restoreEnv('TAVERN_AGENT_MODEL', originalEnv.TAVERN_AGENT_MODEL);
    closeDb();
});

describe('Agent engine model config', () => {
    it('keeps Claude Code out of the LanguageModel resolver', async () => {
        process.env.TAVERN_AGENT_PROVIDER = 'claude';
        process.env.TAVERN_AGENT_MODEL = 'claude-opus-4-8';

        const { resolveAgentLanguageModelConfig } = await import('./model-config.ts');

        await expect(resolveAgentLanguageModelConfig()).rejects.toThrow(
            'Claude Code models execute through the harness executor, not LanguageModel.'
        );
    });

    it('keeps Codex out of the LanguageModel resolver', async () => {
        process.env.TAVERN_AGENT_PROVIDER = 'codex';
        process.env.TAVERN_AGENT_MODEL = 'gpt-5.5';

        const { resolveAgentLanguageModelConfig } = await import('./model-config.ts');

        await expect(resolveAgentLanguageModelConfig()).rejects.toThrow(
            'Codex models execute through the harness executor, not LanguageModel.'
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
