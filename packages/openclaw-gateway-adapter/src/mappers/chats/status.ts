import { type AgentRuntimeChatStatusList, agentRuntimeChatStatusListSchema } from '@tavern/api';
import {
    asRecord,
    readArray,
    readBoolean,
    readString,
    toIsoString,
} from '../../gateway/records.ts';
import { mapOpenClawSessionRecord } from '../sessions/shared.ts';

export function mapOpenClawChatStatuses(value: unknown): AgentRuntimeChatStatusList {
    const sessions = readArray(asRecord(value).sessions);
    const chats = sessions.flatMap((session) => {
        const record = asRecord(session);

        if (!readBoolean(record, ['hasActiveRun'])) {
            return [];
        }

        const mapped = mapOpenClawSessionRecord(record);
        const startedAt = toIsoString(record.startedAt);

        if (!startedAt) {
            return [];
        }

        return [
            {
                activeReply: {
                    agentId: mapped.agentId,
                    isThinking: true,
                    runId:
                        readString(record, ['runId', 'activeRunId', 'chatRunId', 'taskId']) ??
                        `openclaw-active:${mapped.key}:${startedAt}`,
                    sessionKey: mapped.key,
                    startedAt,
                    text: '',
                },
                chatId: mapped.chatId,
            },
        ];
    });

    return agentRuntimeChatStatusListSchema.parse({ chats });
}
