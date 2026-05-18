import type {
    AgentRuntimeChat,
    AgentRuntimeChatParticipant,
    AgentRuntimeChatPlatformMetadata,
} from '@tavern/api';

export interface OpenClawConversationIdentity {
    id: string;
    participants: AgentRuntimeChatParticipant[];
    platform: string;
    platformMetadata: AgentRuntimeChatPlatformMetadata;
    scope: AgentRuntimeChat['scope'];
    target: string | null;
}
