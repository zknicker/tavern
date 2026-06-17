import type { AgentRuntimeSaveVaultSettings, VaultSearchInput } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

function requireRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    return client;
}

export async function getVaultStatus(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getVaultStatus() : null;
}

export async function getVaultSettings(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getVaultSettings() : null;
}

export async function saveVaultSettings(
    input: AgentRuntimeSaveVaultSettings,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveVaultSettings(input);
}

export async function listVaultPages(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listVaultPages() : { pages: [] };
}

export async function getVaultPage(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getVaultPage(input) : null;
}

export async function searchVault(
    input: VaultSearchInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.searchVault(input)
        : {
              hits: [],
              limit: input.limit ?? 20,
              offset: input.offset ?? 0,
              query: input.query,
              totalHitCount: 0,
          };
}

export async function listVaultBacklinks(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listVaultBacklinks(input) : { links: [], targetPath: input.path };
}
