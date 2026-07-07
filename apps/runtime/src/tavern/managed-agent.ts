import type { AgentRuntimeAgent } from '@tavern/api';
import { defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { tasksSkillId, tavernAgentSkillId } from '../agent-engine/skill-library.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { getStoredAgent, upsertStoredAgent } from './agents-store.ts';

export function primaryManagedAgent(): AgentRuntimeAgent {
    return {
        enabledSkillIds: [tavernAgentSkillId, tasksSkillId],
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
        // The managed agent always carries the Tavern-seeded skills, even when
        // it was stored before a new seeded skill existed.
        const upgraded = existing.enabledSkillIds.includes(tasksSkillId)
            ? existing
            : upsertStoredAgent({
                  agent: {
                      ...existing,
                      enabledSkillIds: [...existing.enabledSkillIds, tasksSkillId],
                  },
                  db: targetDb,
              });
        registerAgentWorkspace(targetDb, {
            agentId: upgraded.id,
            agentName: upgraded.name,
            workspaceDir: upgraded.workspaceFolder,
        });
        return upgraded;
    }

    const agent = upsertStoredAgent({ agent: primaryManagedAgent(), db: targetDb });
    registerAgentWorkspace(targetDb, {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });

    return agent;
}
