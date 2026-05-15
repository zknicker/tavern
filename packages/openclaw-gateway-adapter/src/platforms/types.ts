import type {
    AgentRuntimeChat,
    AgentRuntimeChatParticipant,
    AgentRuntimeChatPlatformMetadata,
} from '@tavern/agent-runtime-protocol';

export interface OpenClawConversationIdentity {
    id: string;
    participants: AgentRuntimeChatParticipant[];
    platform: string;
    platformMetadata: AgentRuntimeChatPlatformMetadata;
    scope: AgentRuntimeChat['scope'];
    target: string | null;
}
