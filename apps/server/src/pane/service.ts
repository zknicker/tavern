import type { AgentRuntimeSetChatPaneStateRequest } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

// Pane tab state is a Runtime-owned per-chat record; the server proxies
// reads and revision-guarded writes without mirroring. Realtime invalidation
// arrives via the observed `pane.updated` runtime event.

function requireRuntimeClient(client: TavernAgentRuntimeClient | null) {
    if (!client) {
        throw new Error('Grotto Runtime is not configured.');
    }
    return client;
}

export async function getChatPaneState(
    chatId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).getChatPaneState(chatId);
}

export async function setChatPaneState(
    chatId: string,
    input: AgentRuntimeSetChatPaneStateRequest,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
) {
    return await requireRuntimeClient(client).setChatPaneState(chatId, input);
}
