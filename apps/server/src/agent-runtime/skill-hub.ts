import type {
    AgentRuntimeSkillHubInstallInput,
    AgentRuntimeSkillHubTap,
    AgentRuntimeSkillHubUninstallInput,
} from '@tavern/api';
import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function getAgentRuntimeSkillHubAvailable() {
    return await callSkillHub(
        'skill-hub.status',
        async (client) => await client.getSkillHubAvailable()
    );
}

export async function previewAgentRuntimeSkillHubSkill(identifier: string) {
    return await callSkillHub(
        'skill-hub.status',
        async (client) => await client.previewSkillHubSkill(identifier)
    );
}

export async function scanAgentRuntimeSkillHubSkill(identifier: string) {
    return await callSkillHub(
        'skill-hub.status',
        async (client) => await client.scanSkillHubSkill(identifier)
    );
}

export async function installAgentRuntimeSkillHubSkill(input: AgentRuntimeSkillHubInstallInput) {
    return await callSkillHub(
        'skill-hub.install',
        async (client) => await client.installSkillHubSkill(input)
    );
}

export async function uninstallAgentRuntimeSkillHubSkill(
    input: AgentRuntimeSkillHubUninstallInput
) {
    return await callSkillHub(
        'skill-hub.install',
        async (client) => await client.uninstallSkillHubSkill(input)
    );
}

export async function listAgentRuntimeSkillHubTaps() {
    return await callSkillHub('skill-hub.taps', async (client) => await client.listSkillHubTaps());
}

export async function addAgentRuntimeSkillHubTap(input: AgentRuntimeSkillHubTap) {
    return await callSkillHub(
        'skill-hub.taps',
        async (client) => await client.addSkillHubTap(input)
    );
}

export async function removeAgentRuntimeSkillHubTap(repo: string) {
    return await callSkillHub(
        'skill-hub.taps',
        async (client) => await client.removeSkillHubTap(repo)
    );
}

async function callSkillHub<Result>(
    method: 'skill-hub.install' | 'skill-hub.status' | 'skill-hub.taps',
    run: (client: TavernAgentRuntimeClient) => Promise<Result>
): Promise<Result | null> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return null;
    }

    const runtimeId = getCurrentConfiguredAgentRuntimeConnection()?.id;
    return runtimeId
        ? await withCapabilityStatus(
              { capability: 'skills', method, runtimeId },
              async () => await run(client)
          )
        : await run(client);
}
