import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { type AgentMessage, toAgentMessage } from './agent-messages.ts';
import { formatAgentTarget, resolveAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import {
    AmbiguousMessageIdError,
    claimTask,
    createMessage,
    getChat,
    listReadableChatsForAgentParticipant,
    listTasks,
    promoteMessageToTask,
    recordTaskReceipt,
    resolveMessageId,
    TaskRuleError,
    type TaskStatus,
    taskStatuses,
    unclaimTask,
    updateTaskStatus,
} from './chat-api/index.ts';
import { isArchivedChat } from './chat-guards.ts';

// Agent surface for D8 task-messages: list / create / claim / unclaim /
// update. Claim-before-work is the concurrency lock; task create is the
// convenience helper that posts a fresh message and promotes it in one step.

export const agentTaskListRequest = z.object({
    status: z.enum(['all', ...taskStatuses]).optional(),
    target: z.string().min(1).optional(),
});

export const agentTaskCreateRequestSchema = z.object({
    assignee: z.string().min(1).optional(),
    content: z.string().optional(),
    target: z.string().min(1),
    titles: z.array(z.string().min(1)).max(20).optional(),
});

export const agentTaskClaimRequestSchema = z
    .object({
        messageId: z.string().min(1).optional(),
        numbers: z.array(z.number().int().positive()).max(20).optional(),
        target: z.string().min(1),
    })
    .refine((input) => Boolean(input.messageId) !== Boolean(input.numbers?.length), {
        message: 'Pass either task numbers or one message id.',
    });

export const agentTaskUnclaimRequestSchema = z.object({
    number: z.number().int().positive(),
    target: z.string().min(1),
});

export const agentTaskUpdateRequestSchema = z.object({
    number: z.number().int().positive(),
    status: z.enum(taskStatuses),
    target: z.string().min(1),
});

export interface AgentTaskRow {
    assignee: string | null;
    message: AgentMessage;
    number: number;
    status: TaskStatus;
    target: string | null;
}

export function listAgentTasks(
    agentId: string,
    input: z.infer<typeof agentTaskListRequest>,
    db: Database = getDb()
): { tasks: AgentTaskRow[] } {
    const status = input.status === 'all' ? undefined : input.status;
    const chatId = input.target
        ? resolveAgentTarget({ agentId, target: input.target }, db).chat.id
        : undefined;
    const chatIds = chatId
        ? undefined
        : listReadableChatsForAgentParticipant(createAgentParticipantId(agentId), db).map(
              (chat) => chat.id
          );
    const items = listTasks({ chatId, chatIds, status }, db);
    return {
        tasks: items.map((item) => ({
            assignee: item.task.assignee?.handle ?? null,
            message: toAgentMessage(item.message, db),
            number: item.task.number,
            status: item.task.status,
            target: targetForChat(agentId, item.chatId, db),
        })),
    };
}

export function createAgentTasks(
    agentId: string,
    input: z.infer<typeof agentTaskCreateRequestSchema>,
    db: Database = getDb()
): { tasks: AgentTaskRow[] } {
    const agent = getStoredAgent(agentId, db);
    if (!agent) {
        throw new AgentApiError('TARGET_NOT_FOUND', 'Calling agent was not found.', 404);
    }
    // Agents reserve tasks only for themselves; owner/admin reservation for
    // others is an operator-surface affordance.
    const selfAssign = input.assignee !== undefined;
    if (selfAssign && !matchesHandle(input.assignee ?? '', agent.name)) {
        throw new AgentApiError(
            'INVALID_ARG',
            'Agents may only use --assignee with their own handle.',
            400,
            `--assignee @${agent.name}`
        );
    }
    const bodies = input.titles?.length
        ? input.titles
        : input.content?.trim()
          ? [input.content.trim()]
          : [];
    if (bodies.length === 0) {
        throw new AgentApiError(
            'MISSING_CONTENT',
            'Task create needs --title flags or a stdin body.',
            400
        );
    }
    const resolved = resolveAgentTarget({ agentId, target: input.target }, db);
    if (resolved.chat.kind !== 'channel' && resolved.chat.kind !== 'dm') {
        throw new AgentApiError(
            'INVALID_TARGET',
            'Tasks live on top-level channel or DM messages, not threads.',
            400
        );
    }
    if (isArchivedChat(resolved.chat)) {
        throw new AgentApiError(
            'TARGET_ARCHIVED',
            `${resolved.target} is archived; writes there are rejected.`,
            409
        );
    }
    const participantId = createAgentParticipantId(agentId);
    const created: AgentTaskRow[] = [];
    for (const body of bodies) {
        const receipt = createMessage(
            resolved.chat.id,
            {
                author_id: participantId,
                content: body,
                id: createMessageId(),
                metadata: { runtime: { agentId, source: 'agent-api' } },
                role: 'assistant',
            },
            db
        );
        const task = wrapTaskErrors(() =>
            promoteMessageToTask(
                {
                    actorId: agentId,
                    assigneeId: selfAssign ? agentId : null,
                    messageId: receipt.message.id,
                    origin: 'composed',
                },
                db
            )
        );
        created.push({
            assignee: task.assignee?.handle ?? null,
            message: toAgentMessage(receipt.message, db),
            number: task.number,
            status: task.status,
            target: resolved.target,
        });
    }
    recordTaskReceipt(
        {
            actorId: agentId,
            chatId: resolved.chat.id,
            kind: 'created',
            tasks: created.map((row) => ({
                number: row.number,
                title: row.message.content,
            })),
        },
        db
    );
    return { tasks: created };
}

export function claimAgentTasks(
    agentId: string,
    input: z.infer<typeof agentTaskClaimRequestSchema>,
    db: Database = getDb()
): { claimed: AgentTaskRow[] } {
    const resolved = resolveAgentTarget({ agentId, target: input.target }, db);
    const claimed: AgentTaskRow[] = [];
    if (input.messageId) {
        const message = resolveMessageIdOrThrow(input.messageId, resolved.chat.id, db);
        const task = wrapTaskErrors(() =>
            claimTask({ actorId: agentId, chatId: resolved.chat.id, messageId: message.id }, db)
        );
        claimed.push({
            assignee: task.assignee?.handle ?? null,
            message: toAgentMessage(message, db),
            number: task.number,
            status: task.status,
            target: resolved.target,
        });
        return { claimed };
    }
    for (const number of input.numbers ?? []) {
        const task = wrapTaskErrors(() =>
            claimTask({ actorId: agentId, chatId: resolved.chat.id, number }, db)
        );
        claimed.push({
            assignee: task.assignee?.handle ?? null,
            message: taskMessage(resolved.chat.id, task.number, db),
            number: task.number,
            status: task.status,
            target: resolved.target,
        });
    }
    return { claimed };
}

export function unclaimAgentTask(
    agentId: string,
    input: z.infer<typeof agentTaskUnclaimRequestSchema>,
    db: Database = getDb()
): { task: AgentTaskRow } {
    const resolved = resolveAgentTarget({ agentId, target: input.target }, db);
    const task = wrapTaskErrors(() =>
        unclaimTask({ actorId: agentId, chatId: resolved.chat.id, number: input.number }, db)
    );
    return {
        task: {
            assignee: task.assignee?.handle ?? null,
            message: taskMessage(resolved.chat.id, task.number, db),
            number: task.number,
            status: task.status,
            target: resolved.target,
        },
    };
}

export function updateAgentTask(
    agentId: string,
    input: z.infer<typeof agentTaskUpdateRequestSchema>,
    db: Database = getDb()
): { task: AgentTaskRow } {
    const resolved = resolveAgentTarget({ agentId, target: input.target }, db);
    const existing = listTasks({ chatId: resolved.chat.id }, db).find(
        (item) => item.task.number === input.number
    );
    if (!existing) {
        throw new AgentApiError('TASK_NOT_FOUND', `No task #${input.number} in that target.`, 404);
    }
    if (existing.task.assignee && existing.task.assignee.id !== agentId) {
        throw new AgentApiError(
            'TASK_CLAIMED_BY_OTHER',
            `Task #${input.number} is claimed by another agent.`,
            409
        );
    }
    const task = wrapTaskErrors(() =>
        updateTaskStatus(
            { chatId: resolved.chat.id, number: input.number, status: input.status },
            db
        )
    );
    return {
        task: {
            assignee: task.assignee?.handle ?? null,
            message: taskMessage(resolved.chat.id, task.number, db),
            number: task.number,
            status: task.status,
            target: resolved.target,
        },
    };
}

function taskMessage(chatId: string, number: number, db: Database): AgentMessage {
    const item = listTasks({ chatId }, db).find((row) => row.task.number === number);
    if (!item) {
        throw new AgentApiError('TASK_NOT_FOUND', `No task #${number} in that target.`, 404);
    }
    return toAgentMessage(item.message, db);
}

function resolveMessageIdOrThrow(ref: string, chatId: string, db: Database) {
    let message: ReturnType<typeof resolveMessageId>;
    try {
        message = resolveMessageId(ref, { chatId }, db);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            throw new AgentApiError('AMBIGUOUS_ID', error.message, 409, 'Use the full message id.');
        }
        throw error;
    }
    if (!message) {
        throw new AgentApiError('TARGET_NOT_FOUND', `No message "${ref}" in that target.`, 404);
    }
    return message;
}

function wrapTaskErrors<T>(run: () => T): T {
    try {
        return run();
    } catch (error) {
        if (error instanceof TaskRuleError) {
            throw new AgentApiError(
                taskErrorCode(error.code),
                error.message,
                409,
                taskNextAction(error.code)
            );
        }
        throw error;
    }
}

function taskErrorCode(code: TaskRuleError['code']): string {
    if (code === 'TASK_NOT_FOUND') {
        return 'TASK_NOT_FOUND';
    }
    if (code === 'CLAIM_FAILED' || code === 'TASK_DONE') {
        return 'CLAIM_FAILED';
    }
    if (code === 'ALREADY_TASK') {
        return 'ALREADY_TASK';
    }
    return 'TASK_UPDATE_FAILED';
}

function taskNextAction(code: TaskRuleError['code']): string | undefined {
    if (code === 'CLAIM_FAILED') {
        return 'Do not work on that task unless an owner redirects it to you.';
    }
    return undefined;
}

function matchesHandle(assignee: string, handle: string): boolean {
    const normalized = assignee.startsWith('@') ? assignee.slice(1) : assignee;
    return normalized.toLowerCase() === handle.toLowerCase();
}

function targetForChat(agentId: string, chatId: string, db: Database): string | null {
    const chat = getChat(chatId, db);
    return chat ? formatAgentTarget(agentId, chat, db) : null;
}
