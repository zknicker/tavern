import {
    type AgentRuntimeChatStatusList,
    agentRuntimeChatStatusListSchema,
} from '@tavern/agent-runtime-protocol';

export function mapOpenClawChatStatuses(): AgentRuntimeChatStatusList {
    return agentRuntimeChatStatusListSchema.parse({ chats: [] });
}
