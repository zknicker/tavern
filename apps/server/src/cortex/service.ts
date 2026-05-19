import type {
    CortexCaptureInput,
    CortexJobName,
    CortexRecallInput,
    CortexSearchInput,
} from '@tavern/api';
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

export async function listCortexPages(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listCortexPages() : { pages: [] };
}

export async function getCortexPage(
    slugOrId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.getCortexPage(slugOrId) : null;
}

export async function captureCortex(
    input: CortexCaptureInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).captureCortex(input);
}

export async function searchCortex(
    input: CortexSearchInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.searchCortex(input) : { hits: [], query: input.query };
}

export async function recallCortex(
    input: CortexRecallInput,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).recallCortex(input);
}

export async function listCortexBacklinks(
    slugOrId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return client ? await client.listCortexBacklinks(slugOrId) : { links: [], target: slugOrId };
}

export async function runCortexJob(
    job: CortexJobName,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).runCortexJob(job);
}
