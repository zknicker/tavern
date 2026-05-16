import {
    type AgentRuntimeActiveChatReply,
    type AgentRuntimeChatStatus,
    agentRuntimeActiveChatReplySchema,
    agentRuntimeChatStatusListSchema,
    agentRuntimeChatStatusSchema,
} from '@tavern/agent-runtime-protocol';
import { desc, eq } from 'drizzle-orm';
import { listAgentRuntimeChatStatuses } from '../agent-runtime/chat-status.ts';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';
import { listActiveTurnProgressStatuses } from './active-turn-progress.ts';

export const activeChatReplySchema = agentRuntimeActiveChatReplySchema;
export const chatStatusSchema = agentRuntimeChatStatusSchema;
export const chatStatusListSchema = agentRuntimeChatStatusListSchema;
type SessionMessageRecord = typeof sessionMessagesTable.$inferSelect;

const emptyChatStatuses = chatStatusListSchema.parse({
    chats: [],
});

export async function listChatStatuses() {
    const localStatuses = await listLocallyRecoverableChatStatuses();
    const runtimeStatuses = (await listAgentRuntimeChatStatuses()) ?? emptyChatStatuses;

    return mergeChatStatuses(localStatuses, runtimeStatuses);
}

async function listLocallyRecoverableChatStatuses() {
    const records = await db
        .select()
        .from(sessionMessagesTable)
        .where(eq(sessionMessagesTable.role, 'user'))
        .orderBy(desc(sessionMessagesTable.timestamp))
        .limit(100);
    const allMessages = await db
        .select()
        .from(sessionMessagesTable)
        .orderBy(desc(sessionMessagesTable.timestamp))
        .limit(500);
    const statuses: AgentRuntimeChatStatus[] = [];
    const progressStatuses = await listActiveTurnProgressStatuses();
    const progressByRunId = new Map(
        progressStatuses.map((status) => [status.activeReply.runId, status])
    );

    for (const record of records) {
        const candidate = parseAcceptedActiveReply(record.rawJson);

        if (!candidate || hasLaterAssistantMessage(allMessages, candidate)) {
            continue;
        }

        const progress = progressByRunId.get(candidate.activeReply.runId);

        statuses.push({
            activeReply: candidate.activeReply,
            ...(progress?.activeReplyProgressStartedAt
                ? { activeReplyProgressStartedAt: progress.activeReplyProgressStartedAt }
                : {}),
            ...(progress?.activeReplySteps?.length
                ? { activeReplySteps: progress.activeReplySteps }
                : {}),
            chatId: candidate.chatId,
        });
    }

    for (const status of progressStatuses) {
        const isStale = hasLaterAssistantMessage(allMessages, status);
        const isAlreadyProjected = statuses.some(
            (candidate) => candidate.activeReply.runId === status.activeReply.runId
        );

        if (!(isStale || isAlreadyProjected)) {
            statuses.push(status);
        }
    }

    return chatStatusListSchema.parse({
        chats: statuses,
    });
}

function mergeChatStatuses(
    localStatuses: typeof emptyChatStatuses,
    runtimeStatuses: typeof emptyChatStatuses
) {
    const localRunIds = new Set(localStatuses.chats.map((status) => status.activeReply.runId));

    return chatStatusListSchema.parse({
        chats: [
            ...localStatuses.chats,
            ...runtimeStatuses.chats.filter((status) => !localRunIds.has(status.activeReply.runId)),
        ],
    });
}

function hasLaterAssistantMessage(
    records: SessionMessageRecord[],
    candidate: { activeReply: AgentRuntimeActiveChatReply }
) {
    const startedAt = Date.parse(candidate.activeReply.startedAt);

    return records.some((record) => {
        if (record.role !== 'agent' || record.sessionKey !== candidate.activeReply.sessionKey) {
            return false;
        }

        const timestamp = Date.parse(record.timestamp ?? record.syncedAt);

        return Number.isNaN(startedAt) || Number.isNaN(timestamp) || timestamp >= startedAt;
    });
}

function parseAcceptedActiveReply(rawJson: string) {
    try {
        const parsed = JSON.parse(rawJson) as {
            chatId?: unknown;
            metadata?: {
                tavern?: {
                    acceptedAgentId?: unknown;
                    acceptedRunId?: unknown;
                };
            };
            sessionKey?: unknown;
            timestamp?: unknown;
        };
        const tavern = parsed.metadata?.tavern;

        if (
            typeof parsed.chatId !== 'string' ||
            typeof parsed.sessionKey !== 'string' ||
            typeof parsed.timestamp !== 'string' ||
            typeof tavern?.acceptedAgentId !== 'string' ||
            typeof tavern.acceptedRunId !== 'string'
        ) {
            return null;
        }

        return {
            activeReply: activeChatReplySchema.parse({
                agentId: tavern.acceptedAgentId,
                isThinking: true,
                runId: tavern.acceptedRunId,
                sessionKey: parsed.sessionKey,
                startedAt: parsed.timestamp,
                text: '',
            }),
            chatId: parsed.chatId,
        };
    } catch {
        return null;
    }
}
