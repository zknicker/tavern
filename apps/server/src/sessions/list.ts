import type { AgentRuntimeSession } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import { listRuntimeChatRecords, presentRuntimeChatLabel } from '../chat/runtime-chats.ts';
import { buildAgentRuntimeSessionListItem } from './agent-runtime-shared.ts';
import type { GlobalSessionSummary } from './contracts.ts';

function buildChatTitleMap(chats: Awaited<ReturnType<typeof listRuntimeChatRecords>>) {
    const chatTitlesById = new Map<string, string>();

    for (const record of chats) {
        chatTitlesById.set(record.chat.id, presentRuntimeChatLabel(record.chat));
    }

    return chatTitlesById;
}

function compareSessions(left: AgentRuntimeSession, right: AgentRuntimeSession) {
    const leftTimestamp = left.lastActivityAt ?? left.startedAt ?? new Date(0).toISOString();
    const rightTimestamp = right.lastActivityAt ?? right.startedAt ?? new Date(0).toISOString();

    if (leftTimestamp !== rightTimestamp) {
        return rightTimestamp.localeCompare(leftTimestamp);
    }

    return left.key.localeCompare(right.key);
}

function compareSessionSummaries(left: GlobalSessionSummary, right: GlobalSessionSummary) {
    const leftTimestamp = left.startedAt;
    const rightTimestamp = right.startedAt;

    if (leftTimestamp !== rightTimestamp) {
        return rightTimestamp.localeCompare(leftTimestamp);
    }

    return left.key.localeCompare(right.key);
}

export function mergeSessionSummaries(input: {
    cronRunSessions: GlobalSessionSummary[];
    storedSessions: GlobalSessionSummary[];
}) {
    const cronBaseKeys = new Set(
        input.cronRunSessions
            .map((session) => session.key.replace(/:run:[^:]+$/u, ''))
            .filter((key) => key.includes(':cron:'))
    );

    return [...input.storedSessions, ...input.cronRunSessions]
        .filter(
            (session) =>
                !(
                    session.type === 'cron' &&
                    !session.key.includes(':run:') &&
                    cronBaseKeys.has(session.key)
                )
        )
        .sort(compareSessionSummaries);
}

export async function listSessionSummaries() {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return [];
    }

    try {
        const [chatRecords, sessionsResult] = await Promise.all([
            listRuntimeChatRecords(),
            client.listSessions(),
        ]);
        const chatTitlesById = buildChatTitleMap(chatRecords);

        return sessionsResult.sessions
            .sort(compareSessions)
            .map((session) => buildAgentRuntimeSessionListItem(session, chatTitlesById));
    } finally {
        client.close();
    }
}
