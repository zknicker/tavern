import type { AgentRuntimeAgent } from '@tavern/api';
import { defaultAgentDisplayName, defaultAgentEngineAgentId } from '../agent-engine/constants.ts';
import { tasksSkillId, tavernAgentSkillId } from '../agent-engine/skill-library.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { getStoredAgent, upsertStoredAgent } from './agents-store.ts';

export function primaryManagedAgent(): AgentRuntimeAgent {
    return {
        autoDispatchEnabled: false,
        enabledSkillIds: [tavernAgentSkillId, tasksSkillId],
        id: defaultAgentEngineAgentId,
        isAdmin: true,
        name: defaultAgentDisplayName,
        primaryColor: null,
        taskReviewPolicy: false,
        workspaceFolder: AGENT_WORKSPACE,
    };
}

export function ensurePrimaryManagedAgent(db?: Database) {
    const targetDb = db ?? getDb();
    const existing = getStoredAgent(defaultAgentEngineAgentId, targetDb);
    if (existing) {
        // The managed agent always carries the Tavern-seeded skills, even when
        // it was stored before a new seeded skill existed. Agents stored under
        // the retired "Tavern" default pick up the current default name; a
        // user-chosen name stays put.
        const needsSkill = !existing.enabledSkillIds.includes(tasksSkillId);
        const needsRename = existing.name === 'Tavern';
        const upgraded =
            needsSkill || needsRename
                ? upsertStoredAgent({
                      agent: {
                          ...existing,
                          enabledSkillIds: needsSkill
                              ? [...existing.enabledSkillIds, tasksSkillId]
                              : existing.enabledSkillIds,
                          name: needsRename ? defaultAgentDisplayName : existing.name,
                      },
                      db: targetDb,
                  })
                : existing;
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
