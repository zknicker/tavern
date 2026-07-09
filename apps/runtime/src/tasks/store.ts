import type {
    AgentRuntimeCreateTask,
    AgentRuntimeTask,
    AgentRuntimeTaskKind,
    AgentRuntimeTaskStatus,
    AgentRuntimeUpdateTask,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { assertChatExists, setChatArchived } from '../tavern/chat-api/index.ts';
import { deleteTaskArtifacts, loadAttachmentsForTasks } from './attachments.ts';
import { loadBlockedByMap, replaceTaskDependencies } from './dependencies.ts';
import { loadLabelsForTasks, replaceTaskLabels, resolveLabelNames } from './labels.ts';
import { type TaskRow, taskRowToTask } from './rows.ts';

export interface ListTasksFilter {
    epicId?: string;
    kind?: AgentRuntimeTaskKind;
    status?: AgentRuntimeTaskStatus;
}

export function createTask(input: AgentRuntimeCreateTask, db: Database = getDb()) {
    const now = new Date().toISOString();
    if (input.epicId) {
        assertEpicExists(input.epicId, db);
    }
    const blockedReason = input.status === 'blocked' ? (input.blockedReason ?? null) : null;
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `INSERT INTO tasks (
                id, number, kind, title, description, summary, blocked_reason_kind,
                blocked_reason_message, status, priority, assignee_kind, assignee_agent_id,
                epic_id, scheduled_for, work_chat_id, created_at, updated_at
             )
             VALUES (
                $id, (SELECT COALESCE(MAX(number), 0) + 1 FROM tasks), $kind, $title,
                $description, $summary, $blockedReasonKind, $blockedReasonMessage, $status,
                $priority, $assigneeKind, $assigneeAgentId, $epicId, $scheduledFor,
                NULL, $now, $now
             )`
        ).run(
            namedParams({
                assigneeAgentId: input.assignee?.kind === 'agent' ? input.assignee.agentId : null,
                assigneeKind: input.assignee?.kind ?? null,
                blockedReasonKind: blockedReason?.kind ?? null,
                blockedReasonMessage: blockedReason?.message ?? null,
                description: input.description ?? null,
                epicId: input.epicId ?? null,
                id: input.id,
                kind: input.kind ?? 'task',
                now,
                priority: input.priority ?? 'none',
                scheduledFor: input.scheduledFor ?? null,
                status: input.status ?? 'backlog',
                summary: input.summary ?? null,
                title: input.title,
            })
        );
        const created = getTaskOrThrow(input.id, db);
        replaceTaskDependencies(
            {
                blockedBy: input.blockedBy ?? [],
                taskId: created.id,
                taskKind: created.kind,
                taskNumber: created.number,
            },
            db
        );
        replaceTaskLabels(created.id, resolveLabelNames(input.labels ?? [], db), db);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return getTaskOrThrow(input.id, db);
}

export function updateTask(
    id: string,
    input: AgentRuntimeUpdateTask,
    db: Database = getDb()
): AgentRuntimeTask | null {
    const existing = getTask(id, db);
    if (!existing) {
        return null;
    }
    const merged = mergeTaskUpdate(existing, input);
    if (merged.epicId && merged.epicId !== existing.epicId) {
        assertEpicExists(merged.epicId, db);
    }
    if (merged.epicId === id) {
        throw new Error('A task cannot be its own epic.');
    }
    // A human requeue into todo grants a fresh set of dispatch attempts; the
    // two-strike failure ladder counts per promotion, not per task lifetime.
    const resetAttempts = merged.status === 'todo' && existing.status !== 'todo';
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `UPDATE tasks
             SET title = $title,
                 description = $description,
                 summary = $summary,
                 blocked_reason_kind = $blockedReasonKind,
                 blocked_reason_message = $blockedReasonMessage,
                 status = $status,
                 priority = $priority,
                 assignee_kind = $assigneeKind,
                 assignee_agent_id = $assigneeAgentId,
                 epic_id = $epicId,
                 scheduled_for = $scheduledFor,
                 dispatch_attempts = CASE WHEN $resetAttempts THEN 0 ELSE dispatch_attempts END,
                 updated_at = $now
             WHERE id = $id`
        ).run(
            namedParams({
                assigneeAgentId: merged.assignee?.kind === 'agent' ? merged.assignee.agentId : null,
                assigneeKind: merged.assignee?.kind ?? null,
                blockedReasonKind: merged.blockedReason?.kind ?? null,
                blockedReasonMessage: merged.blockedReason?.message ?? null,
                description: merged.description,
                epicId: merged.epicId,
                id,
                now: new Date().toISOString(),
                priority: merged.priority,
                resetAttempts: resetAttempts ? 1 : 0,
                scheduledFor: merged.scheduledFor,
                status: merged.status,
                summary: merged.summary,
                title: merged.title,
            })
        );
        if (input.blockedBy !== undefined) {
            replaceTaskDependencies(
                {
                    blockedBy: input.blockedBy,
                    taskId: existing.id,
                    taskKind: existing.kind,
                    taskNumber: existing.number,
                },
                db
            );
        }
        if (input.labels !== undefined) {
            replaceTaskLabels(existing.id, resolveLabelNames(input.labels, db), db);
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    const workChatId = existing.workChatId;
    if (workChatId && shouldArchiveWorkChat(existing.status, merged.status, workChatId)) {
        setChatArchived({ archived: true, chatId: workChatId }, db);
    }
    return getTaskOrThrow(id, db);
}

export function setTaskWorkChat(
    taskId: string,
    chatId: string,
    db: Database = getDb()
): AgentRuntimeTask | null {
    const existing = getTask(taskId, db);
    if (!existing) {
        return null;
    }
    assertChatExists(chatId, db);
    db.prepare(
        `UPDATE tasks
         SET work_chat_id = $chatId,
             updated_at = $now
         WHERE id = $taskId`
    ).run(namedParams({ chatId, now: new Date().toISOString(), taskId }));

    return getTaskOrThrow(taskId, db);
}

export function deleteTask(id: string, db: Database = getDb()): boolean {
    const result = db.prepare('DELETE FROM tasks WHERE id = $id').run(namedParams({ id }));
    if (result.changes > 0) {
        deleteTaskArtifacts(id);
    }
    return result.changes > 0;
}

export function listTasks(filter: ListTasksFilter = {}, db: Database = getDb()) {
    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (filter.status) {
        clauses.push('status = $status');
        params.status = filter.status;
    }
    if (filter.kind) {
        clauses.push('kind = $kind');
        params.kind = filter.kind;
    }
    if (filter.epicId) {
        clauses.push('epic_id = $epicId');
        params.epicId = filter.epicId;
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
        .prepare(`SELECT * FROM tasks${where} ORDER BY number DESC`)
        .all(namedParams(params)) as TaskRow[];
    const blockedBy = loadBlockedByMap(
        rows.map((row) => row.id),
        db
    );
    const labels = loadLabelsForTasks(
        rows.map((row) => row.id),
        db
    );
    const attachments = loadAttachmentsForTasks(
        rows.map((row) => row.id),
        db
    );
    return rows.map((row) =>
        taskRowToTask(
            row,
            blockedBy.get(row.id) ?? [],
            labels.get(row.id) ?? [],
            attachments.get(row.id) ?? []
        )
    );
}

export function getTask(id: string, db: Database = getDb()): AgentRuntimeTask | null {
    const row = db
        .prepare('SELECT * FROM tasks WHERE id = $id')
        .get(namedParams({ id })) as TaskRow | null;
    return row
        ? taskRowToTask(
              row,
              loadBlockedByMap([row.id], db).get(row.id) ?? [],
              loadLabelsForTasks([row.id], db).get(row.id) ?? [],
              loadAttachmentsForTasks([row.id], db).get(row.id) ?? []
          )
        : null;
}

export function getTaskByNumber(number: number, db: Database = getDb()): AgentRuntimeTask | null {
    const row = db
        .prepare('SELECT * FROM tasks WHERE number = $number')
        .get(namedParams({ number })) as TaskRow | null;
    return row
        ? taskRowToTask(
              row,
              loadBlockedByMap([row.id], db).get(row.id) ?? [],
              loadLabelsForTasks([row.id], db).get(row.id) ?? [],
              loadAttachmentsForTasks([row.id], db).get(row.id) ?? []
          )
        : null;
}

export function getTaskOrThrow(id: string, db: Database = getDb()): AgentRuntimeTask {
    const task = getTask(id, db);
    if (!task) {
        throw new Error(`Missing task ${id}.`);
    }
    return task;
}

function mergeTaskUpdate(existing: AgentRuntimeTask, input: AgentRuntimeUpdateTask) {
    const merged = { ...existing, ...input };
    return merged.status === 'blocked' ? merged : { ...merged, blockedReason: null };
}

function shouldArchiveWorkChat(
    previous: AgentRuntimeTaskStatus,
    next: AgentRuntimeTaskStatus,
    workChatId: string | null
) {
    return Boolean(workChatId) && !isTerminalStatus(previous) && isTerminalStatus(next);
}

function isTerminalStatus(status: AgentRuntimeTaskStatus) {
    return status === 'done' || status === 'canceled';
}

function assertEpicExists(epicId: string, db: Database) {
    const epic = getTask(epicId, db);
    if (!epic) {
        throw new Error(`Missing epic ${epicId}.`);
    }
    if (epic.kind !== 'epic') {
        throw new Error(`Task ${epicId} is not an epic.`);
    }
}
