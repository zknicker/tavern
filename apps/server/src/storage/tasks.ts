import type { AgentRuntimeTask } from '@tavern/api';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { tasksTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export type TaskRecord = typeof tasksTable.$inferSelect;

export async function listTaskRecords(options?: { runtimeId?: string }) {
    const runtimeId = options?.runtimeId ?? (await getActiveRuntimeId());
    const query = db.select().from(tasksTable);
    const scopedQuery = runtimeId ? query.where(eq(tasksTable.runtimeId, runtimeId)) : query;

    return await scopedQuery.orderBy(desc(tasksTable.number));
}

export async function getTaskRecord(taskId: string) {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);

    return task ?? null;
}

export async function saveTaskRecord(input: {
    runtimeId: string;
    syncedAt?: string;
    task: AgentRuntimeTask;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const row = toTaskRow({ ...input, timestamp });

    await db.insert(tasksTable).values(row).onConflictDoUpdate({
        target: tasksTable.id,
        set: row,
    });

    return row.id;
}

export async function deleteTaskRecord(taskId: string) {
    await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
}

export async function syncTasksForRuntime(input: {
    runtimeId: string;
    syncedAt?: string;
    tasks: AgentRuntimeTask[];
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const syncedIds = input.tasks.map((task) => task.id);

    for (const task of input.tasks) {
        await saveTaskRecord({ runtimeId: input.runtimeId, syncedAt: timestamp, task });
    }

    const staleRows =
        syncedIds.length > 0
            ? await db
                  .delete(tasksTable)
                  .where(
                      and(
                          eq(tasksTable.runtimeId, input.runtimeId),
                          notInArray(tasksTable.id, syncedIds)
                      )
                  )
                  .returning({ id: tasksTable.id })
            : await db
                  .delete(tasksTable)
                  .where(eq(tasksTable.runtimeId, input.runtimeId))
                  .returning({ id: tasksTable.id });

    return {
        deleted: staleRows.length,
        synced: syncedIds.length,
    };
}

export function parseTaskRawJson(task: TaskRecord) {
    return JSON.parse(task.rawJson) as AgentRuntimeTask;
}

function toTaskRow(input: { runtimeId: string; task: AgentRuntimeTask; timestamp: string }) {
    return {
        assigneeAgentId: input.task.assignee?.kind === 'agent' ? input.task.assignee.agentId : null,
        assigneeKind: input.task.assignee?.kind ?? null,
        createdAt: input.task.createdAt,
        epicId: input.task.epicId,
        id: input.task.id,
        kind: input.task.kind,
        lastSyncedAt: input.timestamp,
        number: input.task.number,
        priority: input.task.priority,
        rawJson: JSON.stringify(input.task),
        runtimeId: input.runtimeId,
        runtimeTaskId: input.task.id,
        status: input.task.status,
        title: input.task.title,
        updatedAt: input.task.updatedAt,
    };
}
