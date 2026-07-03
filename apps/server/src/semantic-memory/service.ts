import type {
    AgentRuntimeSaveSemanticMemorySettings,
    SemanticMemoryCreatePage,
    SemanticMemoryMovePath,
    SemanticMemoryPathInput,
    SemanticMemorySavePage,
    SemanticMemorySearchInput,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

function requireRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    return client;
}

export async function getSemanticMemoryStatus(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getSemanticMemoryStatus() : null;
}

export async function getSemanticMemorySettings(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getSemanticMemorySettings() : null;
}

export async function saveSemanticMemorySettings(
    input: AgentRuntimeSaveSemanticMemorySettings,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveSemanticMemorySettings(input);
}

export async function createSemanticMemoryPage(
    input: SemanticMemoryCreatePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createSemanticMemoryPage(input);
}

export async function saveSemanticMemoryPage(
    input: SemanticMemorySavePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveSemanticMemoryPage(input);
}

export async function createSemanticMemoryFolder(
    input: SemanticMemoryPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createSemanticMemoryFolder(input);
}

export async function deleteSemanticMemoryPage(
    input: SemanticMemoryPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteSemanticMemoryPage(input);
}

export async function deleteSemanticMemoryFolder(
    input: SemanticMemoryPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteSemanticMemoryFolder(input);
}

export async function moveSemanticMemoryPath(
    input: SemanticMemoryMovePath,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).moveSemanticMemoryPath(input);
}

export async function listSemanticMemoryPages(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listSemanticMemoryPages() : { folders: [], pages: [] };
}

export async function getSemanticMemoryPage(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getSemanticMemoryPage(input) : null;
}

export async function searchSemanticMemory(
    input: SemanticMemorySearchInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.searchSemanticMemory(input)
        : {
              hits: [],
              limit: input.limit ?? 20,
              offset: input.offset ?? 0,
              query: input.query,
              totalHitCount: 0,
          };
}

export async function listSemanticMemoryBacklinks(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.listSemanticMemoryBacklinks(input)
        : { links: [], targetPath: input.path };
}
