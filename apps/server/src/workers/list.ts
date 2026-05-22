import { presentChatLabel } from '../chat/chat-labels.ts';
import { getSessionDisplay } from '../sessions/display.ts';
import { listAgents } from '../storage/agents.ts';
import { listChatRecords } from '../storage/chats.ts';
import { listSessionRecords, parseSessionRecord } from '../storage/sessions.ts';
import type { WorkerListOutput } from './contracts.ts';

type SessionRecord = NonNullable<ReturnType<typeof parseSessionRecord>>;

function compareWorkerSessions(left: SessionRecord, right: SessionRecord) {
    const leftTimestamp = left.lastActivityAt ?? left.startedAt ?? '';
    const rightTimestamp = right.lastActivityAt ?? right.startedAt ?? '';

    if (leftTimestamp !== rightTimestamp) {
        return rightTimestamp.localeCompare(leftTimestamp);
    }

    return left.key.localeCompare(right.key);
}

export async function listWorkers(): Promise<WorkerListOutput> {
    const [agentRecords, chatRecords, sessionRecords] = await Promise.all([
        listAgents(),
        listChatRecords(),
        listSessionRecords(),
    ]);
    const agentNameById = new Map(agentRecords.map((agent) => [agent.id, agent.name]));
    const chatTitleById = new Map(
        chatRecords.map((chat) => [chat.id, presentChatLabel(chat)])
    );
    const syncedAt = new Date().toISOString();
    const sessions = sessionRecords
        .flatMap((record) => {
            const session = parseSessionRecord(record);

            return session ? [session] : [];
        })
        .filter((session) => session.sessionRole === 'worker')
        .sort(compareWorkerSessions);

    return {
        sync: {
            lastAttemptedAt: null,
            lastError: null,
            lastSuccessfulAt: null,
        },
        workers: sessions.map((session) => {
            const chatTitle = chatTitleById.get(session.chatId) ?? session.title;
            const display = getSessionDisplay({
                key: session.key,
                source: chatTitle,
                title: session.title,
            });

            return {
                agentId: session.agentId,
                agentName: agentNameById.get(session.agentId) ?? session.agentId,
                chatTitle,
                childSessionKey: session.key,
                cleanupAfter: null,
                createdAt: session.startedAt ?? session.lastActivityAt ?? new Date(0).toISOString(),
                description: null,
                detail: null,
                deliveryStatus: null,
                endedAt: session.lastActivityAt,
                error: null,
                executionMode: 'detached_session' as const,
                id: session.key,
                kind: 'cli' as const,
                lastEventAt: session.lastActivityAt,
                notifyPolicy: null,
                parentWorkerId: null,
                progressSummary: null,
                requesterSessionKey: session.parentSessionKey,
                runId: null,
                sessionKey: session.key,
                source: 'agentRuntime' as const,
                sourceFlowId: null,
                sourceId: session.key,
                startedAt: session.startedAt,
                status: 'succeeded' as const,
                syncedAt,
                terminalSummary: null,
                title: display.name,
            };
        }),
    };
}
