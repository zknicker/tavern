import { randomUUID } from 'node:crypto';
import {
    type AgentRuntimeTask,
    type AgentRuntimeTaskDispatchTrigger,
    agentRuntimeDispatchTaskResultSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { sendTavernChannelMessage } from '../tavern/channel-relay.ts';
import { createRunId } from '../tavern/chat-api/ids.ts';
import { createChat, getChat } from '../tavern/chat-api/index.ts';
import { materializeTaskAttachments } from './attachments.ts';
import {
    claimTaskDispatch,
    recordTaskDispatchRun,
    settleTaskDispatchFailure,
} from './dispatch-store.ts';
import { publishTaskUpdated } from './events.ts';
import { recoverTaskDispatchForTurn } from './recovery.ts';
import { getTask, setTaskWorkChat } from './store.ts';

const activeClaims = new Set<string>();

export async function dispatchTaskWorkOrder(input: {
    agentId: string;
    db?: Database;
    taskId: string;
    trigger: AgentRuntimeTaskDispatchTrigger;
}) {
    const db = input.db ?? getDb();
    if (activeClaims.has(input.taskId)) {
        throw new Error('Task dispatch is already being claimed.');
    }
    activeClaims.add(input.taskId);
    try {
        const agent = getStoredAgent(input.agentId, db);
        if (!agent) {
            throw new Error(`Agent "${input.agentId}" does not exist.`);
        }
        const existing = getTask(input.taskId, db);
        if (!existing) {
            throw new Error(`Task "${input.taskId}" does not exist.`);
        }
        const claimed = claimTaskDispatch(
            {
                agentId: input.agentId,
                expectedUpdatedAt: existing.updatedAt,
                taskId: input.taskId,
                trigger: input.trigger,
            },
            db
        );
        if (!claimed) {
            throw new Error('Task dispatch claim was lost.');
        }
        publishTaskUpdated(claimed.id);

        let dispatchRunId: string | null = null;
        try {
            const materializedPaths = await materializeTaskAttachments({
                agentId: input.agentId,
                db,
                taskId: claimed.id,
            });
            const chatId = ensureTaskWorkChat({ agentId: input.agentId, db, task: claimed });
            const messageId = `msg_${randomUUID()}`;
            const runId = createRunId(messageId, input.agentId);
            const dispatched = recordTaskDispatchRun({ runId, taskId: claimed.id }, db);
            if (!dispatched) {
                throw new Error('Task changed before its dispatch run could be recorded.');
            }
            dispatchRunId = runId;
            publishTaskUpdated(dispatched.id);
            const accepted = await sendTavernChannelMessage(chatId, {
                agent: { agentId: input.agentId },
                message: {
                    content: buildDispatchMessage(claimed, materializedPaths),
                    id: messageId,
                    metadata: {
                        tavern: {
                            dispatchTrigger: input.trigger,
                            source: 'task-dispatch',
                            taskId: claimed.id,
                        },
                    },
                    nonce: messageId,
                },
                target: { externalId: null, target: chatId, type: 'tavern' },
            });
            if (accepted.runId !== runId) {
                throw new Error(`Expected dispatched run ${runId}, received ${accepted.runId}.`);
            }
            return agentRuntimeDispatchTaskResultSchema.parse({
                chatId,
                task: getTask(claimed.id, db),
            });
        } catch (error) {
            const detail = `Dispatch failed: ${readError(error)}`;
            if (dispatchRunId) {
                recoverTaskDispatchForTurn(dispatchRunId, { error: detail, status: 'failed' }, db);
            } else {
                const recovered = settleTaskDispatchFailure({ detail, taskId: claimed.id }, db);
                if (recovered) {
                    publishTaskUpdated(recovered.id);
                }
            }
            throw error;
        }
    } finally {
        activeClaims.delete(input.taskId);
    }
}

function ensureTaskWorkChat(input: { agentId: string; db: Database; task: AgentRuntimeTask }) {
    const current = input.task.workChatId ? getChat(input.task.workChatId, input.db) : null;
    const chatId = current?.id ?? `cht_${randomUUID()}`;
    const title = `T-${input.task.number}: ${input.task.title}`;
    const agentIds = new Set(
        (current?.participants ?? [])
            .filter((participant) => participant.kind === 'agent')
            .map((participant) => participant.id)
    );
    agentIds.add(input.agentId);
    const currentTavern = readRecord(current?.metadata.tavern);
    createChat(
        {
            id: chatId,
            kind: 'task',
            metadata: {
                ...(current?.metadata ?? {}),
                runtime: { source: 'tavern' },
                tavern: {
                    ...currentTavern,
                    agentIds: [...agentIds],
                    archived: false,
                    displayName: title,
                    displayNameSource: 'explicit',
                    tabAppearance: readRecord(currentTavern.tabAppearance),
                },
            },
            participants: [
                {
                    id: 'usr_tavern',
                    kind: 'user',
                    label: 'You',
                    metadata: { source: 'tavern' },
                },
                ...[...agentIds].map((agentId) => ({
                    id: agentId,
                    kind: 'agent' as const,
                    label: getStoredAgent(agentId, input.db)?.name ?? agentId,
                    metadata: { agentId, source: 'tavern' },
                })),
            ],
            title,
        },
        input.db
    );
    if (input.task.workChatId !== chatId) {
        setTaskWorkChat(input.task.id, chatId, input.db);
    }
    return chatId;
}

function buildDispatchMessage(task: AgentRuntimeTask, materializedPaths: string[]) {
    const lines = [`You've been dispatched task T-${task.number}: ${task.title}`];
    if (task.description) {
        lines.push('', task.description);
    }
    if (materializedPaths.length > 0) {
        lines.push(
            '',
            `Prior deliverables are in workbench/tasks/T-${task.number}/: ${materializedPaths
                .map((filePath) => filePath.split('/').at(-1))
                .join(', ')}.`
        );
    }
    lines.push(
        '',
        `Start working on it now. Read T-${task.number} first, keep it current, and close it with exactly one terminal tasks_update before ending your reply.`
    );
    return lines.join('\n');
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
