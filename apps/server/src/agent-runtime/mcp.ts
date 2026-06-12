import type { AgentRuntimeMcpCatalogInstall, AgentRuntimeMcpServerCreate } from '@tavern/api';
import { withCapabilityStatus } from './capability-status.ts';
import type { TavernAgentRuntimeClient } from './client.ts';
import {
    createConfiguredAgentRuntimeClient,
    getCurrentConfiguredAgentRuntimeConnection,
} from './configured-client.ts';

export async function listAgentRuntimeMcpServers() {
    return await callMcp('mcp.status', async (client) => await client.listMcpServers());
}

export async function addAgentRuntimeMcpServer(input: AgentRuntimeMcpServerCreate) {
    return await callMcp('mcp.update', async (client) => await client.addMcpServer(input));
}

export async function removeAgentRuntimeMcpServer(name: string) {
    return await callMcp('mcp.update', async (client) => await client.removeMcpServer(name));
}

export async function testAgentRuntimeMcpServer(name: string) {
    return await callMcp('mcp.status', async (client) => await client.testMcpServer(name));
}

export async function setAgentRuntimeMcpServerEnabled(name: string, enabled: boolean) {
    return await callMcp(
        'mcp.update',
        async (client) => await client.setMcpServerEnabled(name, enabled)
    );
}

export async function getAgentRuntimeMcpCatalog() {
    return await callMcp('mcp.status', async (client) => await client.getMcpCatalog());
}

export async function installAgentRuntimeMcpCatalogEntry(input: AgentRuntimeMcpCatalogInstall) {
    return await callMcp(
        'mcp.update',
        async (client) => await client.installMcpCatalogEntry(input)
    );
}

async function callMcp<Result>(
    method: 'mcp.status' | 'mcp.update',
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
