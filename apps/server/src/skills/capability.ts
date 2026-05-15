import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { saveAgentRuntimeCapabilityStatus } from '../storage/agent-runtime-capability-status.ts';
import { assertLocalOpenClawHome, assertLocalOpenClawWorkspacePath } from './local-openclaw.ts';

export async function checkSkillMaterializationCapability(input: {
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}) {
    try {
        await assertLocalOpenClawHome();
        const agents = (await input.client.listAgents()).agents;
        for (const agent of agents) {
            await assertLocalOpenClawWorkspacePath({
                label: `OpenClaw agent "${agent.id}" workspace`,
                workspace: agent.workspaceFolder,
            });
        }
        await saveAgentRuntimeCapabilityStatus({
            capability: 'skillMaterialization',
            method: 'local-openclaw-workspace-probe',
            runtimeId: input.runtimeId,
            state: 'healthy',
        });
    } catch (error) {
        await saveAgentRuntimeCapabilityStatus({
            capability: 'skillMaterialization',
            errorCode: 'openclaw_local_workspace_unavailable',
            method: 'local-openclaw-workspace-probe',
            reason: 'Tavern Runtime must run on the same host as OpenClaw to manage skills.',
            runtimeId: input.runtimeId,
            state: 'degraded',
            technicalMessage: error instanceof Error ? error.message : String(error),
        });
    }
}
