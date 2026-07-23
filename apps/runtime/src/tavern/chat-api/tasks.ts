import type { TavernChatMessage, TavernMessageTask } from '@tavern/api';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { insertEvent, publish } from './events';
import { createMessageId } from './ids';
import {
    actorHandleText,
    type MessageTaskRow,
    rowToTask,
    type TaskPriority,
    type TaskStatus,
    taskRowForMessage,
    taskRowForNumber,
} from './message-annotations';
import { createMessage, getMessage, getMessageOrThrow } from './messages';

// Task-messages (D8): a task is a chat message promoted with task metadata.
// The message IS the task — status/assignee/priority/labels live on the
// message_tasks row keyed by the message, and every board, list, or filter
// surface is a lens over these rows, never a second store.

export type { TaskPriority, TaskStatus } from './message-annotations';

export const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'closed'];
export const taskPriorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];

export class TaskRuleError extends Error {
    readonly code:
        | 'ALREADY_TASK'
        | 'CLAIM_FAILED'
        | 'NOT_A_TASK'
        | 'TASK_DONE'
        | 'TASK_NOT_FOUND'
        | 'UNTASKABLE_MESSAGE';

    constructor(code: TaskRuleError['code'], message: string) {
        super(message);
        this.code = code;
    }
}

export interface TaskListItem {
    chatId: string;
    chatKind: 'channel' | 'dm';
    chatTitle: string | null;
    message: TavernChatMessage;
    task: TavernMessageTask;
}

export function promoteMessageToTask(
    input: {
        actorId: string;
        assigneeId?: string | null;
        messageId: string;
        origin: 'composed' | 'converted';
    },
    db: Database = getDb()
): TavernMessageTask {
    const message = getMessage(input.messageId, db);
    if (!message || message.deleted_at) {
        throw new TaskRuleError('TASK_NOT_FOUND', 'That message does not exist.');
    }
    assertTaskableMessage(message, db);
    if (taskRowForMessage(message.id, db)) {
        throw new TaskRuleError('ALREADY_TASK', 'That message is already a task.');
    }

    const now = new Date().toISOString();
    // --assignee @yourself creates the task claimed: atomically in_progress
    // with a claim timestamp. Any other assignee is a reservation — the task
    // stays todo and the assignee still claims before starting (D8).
    const selfClaim = Boolean(input.assigneeId) && input.assigneeId === input.actorId;
    db.exec('BEGIN IMMEDIATE');
    try {
        const number = nextTaskNumber(message.chat_id, db);
        db.prepare(
            `INSERT INTO message_tasks
             (message_id, chat_id, number, status, assignee_id, claimed_at,
              origin, created_by, created_at, updated_at)
             VALUES ($messageId, $chatId, $number, $status, $assigneeId, $claimedAt,
                     $origin, $createdBy, $now, $now)`
        ).run(
            namedParams({
                assigneeId: input.assigneeId ?? null,
                chatId: message.chat_id,
                claimedAt: selfClaim ? now : null,
                createdBy: input.actorId,
                messageId: message.id,
                now,
                number,
                origin: input.origin,
                status: selfClaim ? 'in_progress' : 'todo',
            })
        );
        const updated = getMessageOrThrow(message.id, db);
        const event = insertEvent(
            { chatId: message.chat_id, event: 'message.updated', payload: { message: updated } },
            db
        );
        db.exec('COMMIT');
        publish(event);
        const task = updated.task;
        if (!task) {
            throw new Error('Task promotion did not persist.');
        }
        return task;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

/**
 * Creation receipts differ by path (Raft parity): compose-time creation posts
 * "📋 N new task created: …", after-the-fact conversion posts
 * "📋 <actor> converted a message to task #N …".
 */
export function recordTaskReceipt(
    input: {
        actorId: string;
        chatId: string;
        kind: 'assigned' | 'converted' | 'created';
        tasks: Array<{ assigneeHandle?: string | null; number: number; title: string }>;
    },
    db: Database = getDb()
): void {
    const content = taskReceiptContent(input, db);
    if (!content) {
        return;
    }
    createMessage(
        input.chatId,
        {
            author_id: 'sys_task',
            content,
            id: createMessageId(),
            metadata: { runtime: { source: 'task-receipt' } },
            role: 'system',
        },
        db
    );
}

export function claimTask(
    input: { actorId: string; chatId: string; messageId?: string; number?: number },
    db: Database = getDb()
): TavernMessageTask {
    const row = input.messageId
        ? taskRowForMessage(input.messageId, db)
        : taskRowForNumber(input.chatId, input.number ?? 0, db);
    if (!row) {
        if (input.messageId) {
            // Claiming a regular message converts it and claims in one step —
            // the taught triage path for existing top-level work requests.
            const task = promoteMessageToTask(
                {
                    actorId: input.actorId,
                    assigneeId: input.actorId,
                    messageId: input.messageId,
                    origin: 'converted',
                },
                db
            );
            const message = getMessageOrThrow(input.messageId, db);
            recordTaskReceipt(
                {
                    actorId: input.actorId,
                    chatId: message.chat_id,
                    kind: 'converted',
                    tasks: [{ number: task.number, title: message.content }],
                },
                db
            );
            return task;
        }
        throw new TaskRuleError('TASK_NOT_FOUND', `No task #${input.number} in that target.`);
    }
    if (row.status === 'done') {
        throw new TaskRuleError('TASK_DONE', `Task #${row.number} is done; claims are closed.`);
    }
    if (row.assignee_id && row.assignee_id !== input.actorId) {
        throw new TaskRuleError(
            'CLAIM_FAILED',
            `Task #${row.number} is already claimed by ${actorHandleText(row.assignee_id, db)}.`
        );
    }
    return mutateTask(
        row,
        {
            assignee_id: input.actorId,
            claimed_at: new Date().toISOString(),
            status: row.status === 'todo' ? 'in_progress' : row.status,
        },
        db
    );
}

export function unclaimTask(
    input: { actorId: string; chatId: string; number: number },
    db: Database = getDb()
): TavernMessageTask {
    const row = requireTaskRow(input.chatId, input.number, db);
    if (row.assignee_id !== input.actorId) {
        throw new TaskRuleError(
            'CLAIM_FAILED',
            `Task #${row.number} is not claimed by the caller.`
        );
    }
    return mutateTask(row, { assignee_id: null, claimed_at: null }, db);
}

export function updateTaskStatus(
    input: { chatId: string; number: number; status: TaskStatus },
    db: Database = getDb()
): TavernMessageTask {
    const row = requireTaskRow(input.chatId, input.number, db);
    return mutateTask(row, { status: input.status }, db);
}

/** App-side lens edits: assignee, priority, labels, status in one patch. */
export function updateTaskFields(
    input: {
        assigneeId?: string | null;
        labelIds?: string[];
        messageId: string;
        priority?: TaskPriority;
        status?: TaskStatus;
    },
    db: Database = getDb()
): TavernMessageTask {
    const row = taskRowForMessage(input.messageId, db);
    if (!row) {
        throw new TaskRuleError('NOT_A_TASK', 'That message is not a task.');
    }
    return mutateTask(
        row,
        {
            ...(input.assigneeId === undefined
                ? {}
                : {
                      assignee_id: input.assigneeId,
                      ...(input.assigneeId ? {} : { claimed_at: null }),
                  }),
            ...(input.labelIds === undefined
                ? {}
                : { label_ids_json: JSON.stringify(input.labelIds) }),
            ...(input.priority === undefined ? {} : { priority: input.priority }),
            ...(input.status === undefined ? {} : { status: input.status }),
        },
        db
    );
}

export function listTasks(
    input: {
        assigneeId?: string;
        chatId?: string;
        createdBy?: string;
        status?: TaskStatus;
    } = {},
    db: Database = getDb()
): TaskListItem[] {
    const rows = db
        .prepare(
            `SELECT message_tasks.*, chats.kind AS chat_kind, chats.title AS chat_title
             FROM message_tasks
             JOIN chats ON chats.id = message_tasks.chat_id
             WHERE ($chatId IS NULL OR message_tasks.chat_id = $chatId)
               AND ($status IS NULL OR message_tasks.status = $status)
               AND ($assigneeId IS NULL OR message_tasks.assignee_id = $assigneeId)
               AND ($createdBy IS NULL OR message_tasks.created_by = $createdBy)
             ORDER BY message_tasks.updated_at DESC`
        )
        .all(
            namedParams({
                assigneeId: input.assigneeId ?? null,
                chatId: input.chatId ?? null,
                createdBy: input.createdBy ?? null,
                status: input.status ?? null,
            })
        ) as Array<MessageTaskRow & { chat_kind: string; chat_title: string | null }>;
    const items: TaskListItem[] = [];
    for (const row of rows) {
        if (row.chat_kind !== 'channel' && row.chat_kind !== 'dm') {
            continue;
        }
        const message = getMessage(row.message_id, db);
        if (!message || message.deleted_at) {
            continue;
        }
        items.push({
            chatId: row.chat_id,
            chatKind: row.chat_kind,
            chatTitle: row.chat_title,
            message,
            task: rowToTask(row, db),
        });
    }
    return items;
}

function mutateTask(
    row: MessageTaskRow,
    patch: Partial<
        Pick<
            MessageTaskRow,
            'assignee_id' | 'claimed_at' | 'label_ids_json' | 'priority' | 'status'
        >
    >,
    db: Database
): TavernMessageTask {
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `UPDATE message_tasks
             SET status = $status, assignee_id = $assigneeId, claimed_at = $claimedAt,
                 priority = $priority, label_ids_json = $labelIdsJson, updated_at = $now
             WHERE message_id = $messageId`
        ).run(
            namedParams({
                assigneeId: patch.assignee_id === undefined ? row.assignee_id : patch.assignee_id,
                claimedAt: patch.claimed_at === undefined ? row.claimed_at : patch.claimed_at,
                labelIdsJson: patch.label_ids_json ?? row.label_ids_json,
                messageId: row.message_id,
                now,
                priority: patch.priority ?? row.priority,
                status: patch.status ?? row.status,
            })
        );
        const updated = getMessageOrThrow(row.message_id, db);
        const event = insertEvent(
            { chatId: row.chat_id, event: 'message.updated', payload: { message: updated } },
            db
        );
        db.exec('COMMIT');
        publish(event);
        const task = updated.task;
        if (!task) {
            throw new Error('Task update did not persist.');
        }
        return task;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function taskReceiptContent(
    input: Parameters<typeof recordTaskReceipt>[0],
    db: Database
): string | null {
    const first = input.tasks[0];
    if (!first) {
        return null;
    }
    if (input.kind === 'converted') {
        const actor = actorHandleText(input.actorId, db);
        return `📋 ${actor} converted a message to task #${first.number} "${receiptTitle(first.title)}"`;
    }
    if (input.kind === 'assigned') {
        return input.tasks
            .map(
                (task) =>
                    `📋 task #${task.number} assigned to @${task.assigneeHandle}: "${receiptTitle(task.title)}"`
            )
            .join('\n');
    }
    const refs = input.tasks
        .map((task) => `#${task.number} "${receiptTitle(task.title)}"`)
        .join(', ');
    const noun = input.tasks.length === 1 ? 'task' : 'tasks';
    return `📋 ${input.tasks.length} new ${noun} created: ${refs}`;
}

function assertTaskableMessage(message: TavernChatMessage, db: Database): void {
    if (message.role === 'system') {
        throw new TaskRuleError('UNTASKABLE_MESSAGE', 'System messages cannot become tasks.');
    }
    const chat = db
        .prepare('SELECT kind FROM chats WHERE id = $chatId')
        .get(namedParams({ chatId: message.chat_id })) as { kind: string } | null;
    if (!chat || (chat.kind !== 'channel' && chat.kind !== 'dm')) {
        // Thread messages are discussion context; claims and conversions stay
        // on top-level channel/DM messages (D8).
        throw new TaskRuleError(
            'UNTASKABLE_MESSAGE',
            'Only top-level channel or DM messages can become tasks.'
        );
    }
}

function nextTaskNumber(chatId: string, db: Database): number {
    const row = db
        .prepare(
            'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM message_tasks WHERE chat_id = $chatId'
        )
        .get(namedParams({ chatId })) as { next: number };
    return row.next;
}

function requireTaskRow(chatId: string, number: number, db: Database): MessageTaskRow {
    const row = taskRowForNumber(chatId, number, db);
    if (!row) {
        throw new TaskRuleError('TASK_NOT_FOUND', `No task #${number} in that target.`);
    }
    return row;
}

/** Receipts quote the origin body, truncated the way Raft truncates. */
function receiptTitle(title: string): string {
    const flat = title.replaceAll(/\s+/gu, ' ').trim();
    return flat.length > 40 ? `${flat.slice(0, 27).trimEnd()}…` : flat;
}
