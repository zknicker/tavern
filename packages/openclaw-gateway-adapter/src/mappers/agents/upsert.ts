import type { AgentRuntimeCreateAgent, AgentRuntimeUpdateAgent } from '@tavern/api';

export function mapTavernAgentToOpenClawUpsert(
    input: AgentRuntimeCreateAgent | AgentRuntimeUpdateAgent
) {
    return {
        agentId: 'id' in input ? input.id : undefined,
        enabledSkillIds: input.enabledSkillIds,
        isAdmin: input.isAdmin,
        name: input.name,
        workspaceFolder: input.workspaceFolder,
    };
}
