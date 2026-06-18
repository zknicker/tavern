import type {
    AgentRuntimeSaveVaultSettings,
    VaultCreatePage,
    VaultMovePath,
    VaultPathInput,
    VaultSavePage,
    VaultSearchInput,
} from '@tavern/api';
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

export async function createVaultPage(
    input: VaultCreatePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createVaultPage(input);
}

export async function saveVaultPage(
    input: VaultSavePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveVaultPage(input);
}

export async function createVaultFolder(
    input: VaultPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createVaultFolder(input);
}

export async function deleteVaultPage(
    input: VaultPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteVaultPage(input);
}

export async function deleteVaultFolder(
    input: VaultPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteVaultFolder(input);
}

export async function moveVaultPath(
    input: VaultMovePath,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).moveVaultPath(input);
}

export async function listVaultPages(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listVaultPages() : { folders: [], pages: [] };
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
