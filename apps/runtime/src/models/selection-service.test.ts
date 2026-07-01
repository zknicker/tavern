import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        vi.unstubAllEnvs();
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
        vi.stubEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', process.execPath);
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('TAVERN_AGENT_API_KEY', '');
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
