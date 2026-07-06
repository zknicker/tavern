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
    db.prepare(
        `INSERT INTO tasks (
            id, number, kind, title, description, status, priority,
            assignee_kind, assignee_agent_id, epic_id, labels_json, created_at, updated_at
         )
         VALUES (
            $id, (SELECT COALESCE(MAX(number), 0) + 1 FROM tasks), $kind, $title, $description,
            $status, $priority, $assigneeKind, $assigneeAgentId, $epicId, $labelsJson, $now, $now
         )`
    ).run(
        namedParams({
            assigneeAgentId: input.assignee?.kind === 'agent' ? input.assignee.agentId : null,
            assigneeKind: input.assignee?.kind ?? null,
            description: input.description ?? null,
            epicId: input.epicId ?? null,
            id: input.id,
            kind: input.kind ?? 'task',
            labelsJson: JSON.stringify(input.labels ?? []),
            now,
            priority: input.priority ?? 'none',
            status: input.status ?? 'backlog',
            title: input.title,
        })
    );
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
    const merged = { ...existing, ...input };
    if (merged.epicId && merged.epicId !== existing.epicId) {
        assertEpicExists(merged.epicId, db);
    }
    if (merged.epicId === id) {
        throw new Error('A task cannot be its own epic.');
    }
    db.prepare(
        `UPDATE tasks
         SET title = $title,
             description = $description,
             status = $status,
             priority = $priority,
             assignee_kind = $assigneeKind,
             assignee_agent_id = $assigneeAgentId,
             epic_id = $epicId,
             labels_json = $labelsJson,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            assigneeAgentId: merged.assignee?.kind === 'agent' ? merged.assignee.agentId : null,
            assigneeKind: merged.assignee?.kind ?? null,
            description: merged.description,
            epicId: merged.epicId,
            id,
            labelsJson: JSON.stringify(merged.labels),
            now: new Date().toISOString(),
            priority: merged.priority,
            status: merged.status,
            title: merged.title,
        })
    );
    return getTaskOrThrow(id, db);
}

export function deleteTask(id: string, db: Database = getDb()): boolean {
    const result = db.prepare('DELETE FROM tasks WHERE id = $id').run(namedParams({ id }));
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
    return rows.map(taskRowToTask);
}

export function getTask(id: string, db: Database = getDb()): AgentRuntimeTask | null {
    const row = db
        .prepare('SELECT * FROM tasks WHERE id = $id')
        .get(namedParams({ id })) as TaskRow | null;
    return row ? taskRowToTask(row) : null;
}

export function getTaskByNumber(number: number, db: Database = getDb()): AgentRuntimeTask | null {
    const row = db
        .prepare('SELECT * FROM tasks WHERE number = $number')
        .get(namedParams({ number })) as TaskRow | null;
    return row ? taskRowToTask(row) : null;
}

export function getTaskOrThrow(id: string, db: Database = getDb()): AgentRuntimeTask {
    const task = getTask(id, db);
    if (!task) {
        throw new Error(`Missing task ${id}.`);
    }
    return task;
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
