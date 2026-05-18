import type { AgentRuntimeChat } from '@tavern/api';
import type { TavernAgentRuntimeClient } from './client.ts';
import { createConfiguredAgentRuntimeClient } from './configured-client.ts';

export interface AgentRuntimePublishedChat {
    agentIds: string[];
    displayName: string;
    id: string;
}

export function buildTavernChatRecord(chat: AgentRuntimePublishedChat): AgentRuntimeChat {
    const sessionKey =
        chat.agentIds.length === 1
            ? buildTavernChatSessionKey(chat.agentIds[0] ?? '', chat.id)
            : null;
    const target = `chat:${chat.id}`;

    return {
        bindingId: null,
        bindings: chat.agentIds.map((agentId) => ({ agentId })),
        id: chat.id,
        inboundMode: 'active' as const,
        metadata: {
            tavern: {
                displayName: chat.displayName,
            },
            ...(sessionKey ? { sessionKeys: [sessionKey] } : {}),
        },
        parentTarget: null,
        participants: chat.agentIds.map((agentId) => ({
            agentId,
            type: 'agent' as const,
        })),
        platform: 'tavern',
        platformMetadata: {
            chatId: chat.id,
            conversationId: null,
            observedLabels: [chat.displayName],
            provider: 'tavern',
            sourceRecords: sessionKey
                ? [
                      {
                          chatId: chat.id,
                          clientMessageId: null,
                          conversationId: null,
                          deliveryId: null,
                          runId: null,
                          sessionKey,
                          source: {
                              channel: 'tavern',
                              target,
                          },
                      },
                  ]
                : [],
        },
        requiresTrigger: false,
        scope: null,
        target,
        trigger: null,
    };
}

export function buildTavernChatSessionKey(agentId: string, chatId: string) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}

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
