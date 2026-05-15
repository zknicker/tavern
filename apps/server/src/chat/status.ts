import {
    agentRuntimeActiveChatReplySchema,
    agentRuntimeChatStatusListSchema,
    agentRuntimeChatStatusSchema,
} from '@tavern/agent-runtime-protocol';
import { listAgentRuntimeChatStatuses } from '../agent-runtime/chat-status.ts';

export const activeChatReplySchema = agentRuntimeActiveChatReplySchema;
export const chatStatusSchema = agentRuntimeChatStatusSchema;
export const chatStatusListSchema = agentRuntimeChatStatusListSchema;

const emptyChatStatuses = chatStatusListSchema.parse({
    chats: [],
});

export async function listChatStatuses() {
    return (await listAgentRuntimeChatStatuses()) ?? emptyChatStatuses;
}
