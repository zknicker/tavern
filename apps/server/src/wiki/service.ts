import type {
    AgentRuntimeSaveWikiSettings,
    WikiCreatePage,
    WikiMovePath,
    WikiPathInput,
    WikiSavePage,
    WikiSearchInput,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

function requireRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error('Tavern Runtime is not configured.');
    }
    return client;
}

export async function getWikiStatus(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getWikiStatus() : null;
}

export async function getWikiSettings(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getWikiSettings() : null;
}

export async function saveWikiSettings(
    input: AgentRuntimeSaveWikiSettings,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveWikiSettings(input);
}

export async function createWikiPage(
    input: WikiCreatePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createWikiPage(input);
}

export async function saveWikiPage(
    input: WikiSavePage,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).saveWikiPage(input);
}

export async function createWikiFolder(
    input: WikiPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).createWikiFolder(input);
}

export async function deleteWikiPage(
    input: WikiPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteWikiPage(input);
}

export async function deleteWikiFolder(
    input: WikiPathInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).deleteWikiFolder(input);
}

export async function moveWikiPath(
    input: WikiMovePath,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).moveWikiPath(input);
}

export async function listWikiPages(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listWikiPages() : { folders: [], pages: [] };
}

export async function getWikiPage(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getWikiPage(input) : null;
}

export async function searchWiki(
    input: WikiSearchInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client
        ? await client.searchWiki(input)
        : {
              hits: [],
              limit: input.limit ?? 20,
              offset: input.offset ?? 0,
              query: input.query,
              totalHitCount: 0,
          };
}

export async function listWikiBacklinks(
    input: { path: string },
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listWikiBacklinks(input) : { links: [], targetPath: input.path };
}
