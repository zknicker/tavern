import type { AgentRuntimeChat } from '@tavern/api';
import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export async function listAgentRuntimeChats(
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeChat[] | null> {
    if (!client) {
        return null;
    }

    return (await client.listChats()).chats;
}

export async function getAgentRuntimeChat(
    chatId: string,
    client: TavernAgentRuntimeClient | null = createConfiguredAgentRuntimeClient()
): Promise<AgentRuntimeChat | null> {
    const chats = await listAgentRuntimeChats(client);

    if (!chats) {
        return null;
    }

    return chats.find((chat) => chat.id === chatId) ?? null;
}
