import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { runRuntimeDoctor } from '../doctor/runtime-doctor.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { setModelProviderEnabled } from './provider-store.ts';
import { readAgentRuntimeProfile } from './runtime-profile-store.ts';
import { resolveAgentModelSelection, saveAgentModelSelectionIntent } from './selection-service.ts';
import { readAgentModelSelection } from './selection-store.ts';

describe('Runtime agent model selection', () => {
    const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
    const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
    const originalTavernAgentApiKey = process.env.TAVERN_AGENT_API_KEY;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: defaultAgentEngineAgentId,
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: AGENT_WORKSPACE,
            },
        });
    });

    afterEach(() => {
        restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
        restoreEnv('OPENAI_API_KEY', originalOpenAiApiKey);
        restoreEnv('TAVERN_AGENT_API_KEY', originalTavernAgentApiKey);
        closeDb();
    });

    it('stores the selected model as per-agent execution state', () => {
        const profile = saveAgentModelSelectionIntent({
            agentId: defaultAgentEngineAgentId,
            modelName: { model: 'gpt-5.5', provider: 'codex' },
        });

        expect(profile).toMatchObject({
            agentId: defaultAgentEngineAgentId,
            defaultModel: { model: 'gpt-5.5', provider: 'codex' },
            sandboxMode: 'none',
        });
        expect(readAgentRuntimeProfile(defaultAgentEngineAgentId)).toMatchObject({
            agentId: defaultAgentEngineAgentId,
            defaultModel: { model: 'gpt-5.5', provider: 'codex' },
        });
        expect(readAgentModelSelection(defaultAgentEngineAgentId)).toMatchObject({
            agentId: defaultAgentEngineAgentId,
            modelName: { model: 'gpt-5.5', provider: 'codex' },
            status: 'unknown',
        });
        expect(resolveAgentModelSelection({ agentId: defaultAgentEngineAgentId })).toEqual({
            model: 'gpt-5.5',
            provider: 'codex',
        });
    });

    it('Doctor sets an Agent default from executable provider inventory', async () => {
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        process.env.OPENAI_API_KEY = '';
        process.env.TAVERN_AGENT_API_KEY = '';
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        const result = await runRuntimeDoctor({
            modules: ['agents'],
            reason: 'runtime_start',
        });

        expect(result[0]?.status).toBe('repaired');
        expect(resolveAgentModelSelection({ agentId: defaultAgentEngineAgentId })).toEqual({
            model: 'claude-sonnet-4-6',
            provider: 'claude',
        });
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}
