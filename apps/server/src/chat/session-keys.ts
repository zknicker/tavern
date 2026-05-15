import type { AgentRuntimeChat } from '@tavern/agent-runtime-protocol';
import { buildTavernChatSessionKey } from '../agent-runtime/chats.ts';

export function findChatSessionKeyForAgent(chat: AgentRuntimeChat, agentId: string) {
    const sessionKeys = Array.isArray(chat.metadata.sessionKeys)
        ? chat.metadata.sessionKeys.filter((value): value is string => typeof value === 'string')
        : [];
    const agentPrefix = `agent:${agentId}:`;

    return (
        sessionKeys
            .filter((sessionKey) => sessionKey.startsWith(agentPrefix))
            .filter((sessionKey) => !sessionKey.includes(':subagent:'))
            .sort()[0] ?? null
    );
}

export function requireStoredTavernSessionKey(chat: AgentRuntimeChat, agentId: string) {
    const sessionKeys = Array.isArray(chat.metadata.sessionKeys)
        ? chat.metadata.sessionKeys.filter((value): value is string => typeof value === 'string')
        : [];
    const expectedSessionKey = buildTavernChatSessionKey(agentId, chat.id);

    if (!sessionKeys.includes(expectedSessionKey)) {
        throw new Error(`Tavern chat "${chat.id}" is missing session key "${expectedSessionKey}".`);
    }

    return expectedSessionKey;
}
