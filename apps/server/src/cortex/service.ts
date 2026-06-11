import type { CortexSearchInput } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

function requireRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    return client;
}

export async function getCortexStatus(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getCortexStatus() : null;
}

export async function getCortexHealth(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getCortexHealth() : null;
}

export async function listCortexTopics(
    input: { includeArchived?: boolean } = {},
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listCortexTopics(input) : { hubPath: '', topics: [] };
}

export async function listCortexPages(
    input: { includeArchived?: boolean; topic?: string | null } = {},
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listCortexPages(input) : { pages: [], topic: input.topic ?? null };
}

export async function getCortexPage(
    input: { path: string; topic: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getCortexPage(input) : null;
}

export async function searchCortex(
    input: CortexSearchInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.searchCortex(input)
        : {
              hits: [],
              limit: input.limit ?? 20,
              offset: input.offset ?? 0,
              query: input.query,
              totalHitCount: 0,
          };
}

export async function listCortexBacklinks(
    input: { path: string; topic: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.listCortexBacklinks(input)
        : { links: [], targetPath: input.path, topic: input.topic };
}

export async function requireCortexRuntime() {
    return requireRuntimeClient(createConfiguredAgentRuntimeClient());
}
