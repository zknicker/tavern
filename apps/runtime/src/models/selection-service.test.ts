import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
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
});
