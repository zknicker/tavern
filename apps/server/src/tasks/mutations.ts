import { requireConfiguredAgentRuntimeClientForRuntimeId } from '../agent-runtime/configured-client.ts';
import { emitTasksUpdated } from '../api/invalidation-events.ts';
import { getActiveRuntimeId } from '../storage/agent-runtime-connections.ts';
import { deleteTaskRecord, saveTaskRecord } from '../storage/tasks.ts';
import { syncAgentRuntimeTasks } from '../sync/agent-runtime-sync.ts';
import {
    createTaskInputSchema,
    deleteTaskInputSchema,
    taskSchema,
    updateTaskInputSchema,
} from './contracts.ts';

export async function createTask(input: unknown) {
    const parsed = createTaskInputSchema.parse(input);
    const { client, runtimeId } = await requireActiveTaskRuntime();
    const created = await client.createTask({
        ...parsed,
        id: `tsk_${crypto.randomUUID()}`,
    });

    await saveTaskRecord({ runtimeId, task: created });
    refreshTasksInBackground('create');
    emitTasksUpdated();

    return taskSchema.parse(created);
}

export async function updateTask(input: unknown) {
    const parsed = updateTaskInputSchema.parse(input);
    const { client, runtimeId } = await requireActiveTaskRuntime();
    const updated = await client.updateTask(parsed.taskId, parsed.patch);

    await saveTaskRecord({ runtimeId, task: updated });
    refreshTasksInBackground('update');
    emitTasksUpdated();

    return taskSchema.parse(updated);
}

export async function deleteTask(input: unknown) {
    const parsed = deleteTaskInputSchema.parse(input);
    const { client } = await requireActiveTaskRuntime();

    await client.deleteTask(parsed.taskId);
    await deleteTaskRecord(parsed.taskId);
    refreshTasksInBackground('delete');
    emitTasksUpdated();

    return { deleted: true as const, taskId: parsed.taskId };
}

export async function requireActiveTaskRuntime() {
    const runtimeId = await getActiveRuntimeId();

    if (!runtimeId) {
        throw new Error('No active Grotto Runtime connection is available.');
    }

    return {
        client: await requireConfiguredAgentRuntimeClientForRuntimeId(runtimeId),
        runtimeId,
    };
}

function refreshTasksInBackground(action: string) {
    void syncAgentRuntimeTasks().catch((error) => {
        console.warn(`[tavern] failed to refresh task records after ${action}`, error);
    });
}
