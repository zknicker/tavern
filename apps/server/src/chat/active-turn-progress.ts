import type { AgentRuntimeChatStatus, AgentRuntimeEvent } from '@tavern/agent-runtime-protocol';
import { agentRuntimeChatStatusSchema } from '@tavern/agent-runtime-protocol';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { chatActiveTurnStepsTable } from '../db/schema.ts';

type TurnProgressEvent = Extract<AgentRuntimeEvent, { type: 'turn.progress' }>;

export async function projectActiveTurnProgress(event: TurnProgressEvent) {
    const timestamp = event.timestamp;

    await db
        .insert(chatActiveTurnStepsTable)
        .values({
            agentId: event.turn.agentId,
            chatId: event.turn.chatId,
            firstObservedAt: timestamp,
            progressStartedAt: timestamp,
            runId: event.turn.runId,
            sessionKey: event.turn.sessionKey,
            startedAt: event.turn.startedAt,
            stepId: event.step.id,
            stepJson: JSON.stringify(event.step),
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            set: {
                agentId: event.turn.agentId,
                chatId: event.turn.chatId,
                sessionKey: event.turn.sessionKey,
                startedAt: event.turn.startedAt,
                stepJson: JSON.stringify(event.step),
                updatedAt: timestamp,
            },
            target: [
                chatActiveTurnStepsTable.sessionKey,
                chatActiveTurnStepsTable.runId,
                chatActiveTurnStepsTable.stepId,
            ],
        });
}

export async function clearActiveTurnProgress(input: { runId: string; sessionKey: string }) {
    await db
        .delete(chatActiveTurnStepsTable)
        .where(
            and(
                eq(chatActiveTurnStepsTable.runId, input.runId),
                eq(chatActiveTurnStepsTable.sessionKey, input.sessionKey)
            )
        );
}

export async function listActiveTurnProgressStatuses(): Promise<AgentRuntimeChatStatus[]> {
    const rows = await db
        .select()
        .from(chatActiveTurnStepsTable)
        .orderBy(chatActiveTurnStepsTable.firstObservedAt);
    const byTurn = new Map<string, typeof rows>();

    for (const row of rows) {
        const key = `${row.sessionKey}:${row.runId}`;
        byTurn.set(key, [...(byTurn.get(key) ?? []), row]);
    }

    return [...byTurn.values()].map((runRows) => {
        const first = runRows[0];

        if (!first) {
            throw new Error('Cannot build active turn progress status without rows.');
        }

        return agentRuntimeChatStatusSchema.parse({
            activeReply: {
                agentId: first.agentId,
                isThinking: true,
                runId: first.runId,
                sessionKey: first.sessionKey,
                startedAt: first.startedAt,
                text: '',
            },
            activeReplyProgressStartedAt: first.progressStartedAt,
            activeReplySteps: runRows.map((row) => JSON.parse(row.stepJson)),
            chatId: first.chatId,
        });
    });
}
