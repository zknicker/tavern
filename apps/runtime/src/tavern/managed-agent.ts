import type { AgentRuntimeAgent } from '@tavern/api';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { tavernAgentSkillId } from '../agent-engine/skill-library.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { getStoredAgent, upsertStoredAgent } from './agents-store.ts';

export function primaryManagedAgent(): AgentRuntimeAgent {
    return {
        enabledSkillIds: [tavernAgentSkillId],
        id: defaultAgentEngineAgentId,
        isAdmin: true,
        name: 'Tavern',
        primaryColor: null,
        workspaceFolder: AGENT_WORKSPACE,
    };
}

export function ensurePrimaryManagedAgent(db?: Database) {
    const targetDb = db ?? getDb();
    const existing = getStoredAgent(defaultAgentEngineAgentId, targetDb);
    if (existing) {
        registerAgentWorkspace(targetDb, {
            agentId: existing.id,
            agentName: existing.name,
            workspaceDir: existing.workspaceFolder,
        });
        return existing;
    }

    const agent = upsertStoredAgent({ agent: primaryManagedAgent(), db: targetDb });
    registerAgentWorkspace(targetDb, {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });

    return agent;
}
