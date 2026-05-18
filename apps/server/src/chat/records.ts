import type { AgentRuntimeChat } from '@tavern/api';
import { emitSyncDataUpdated } from '../api/invalidation-events.ts';
import { syncChatParticipantsForRuntime } from '../participants/chat-participants.ts';
import { upsertChatForRuntime } from '../storage/chats.ts';

export async function saveTavernChatRecord(input: {
    chat: AgentRuntimeChat;
    runtimeId: string;
    syncedAt?: string;
}) {
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const chatResult = await upsertChatForRuntime({
        chat: input.chat,
        runtimeId: input.runtimeId,
        syncedAt,
    });
    const participantResult = await syncChatParticipantsForRuntime({
        chats: [input.chat],
        syncedAt,
    });
    const result = {
        deleted: chatResult.deleted,
        synced: chatResult.synced + participantResult.synced,
    };

    if (result.synced > 0 || result.deleted > 0) {
        emitSyncDataUpdated();
    }

    return result;
}
