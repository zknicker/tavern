import { getTaskRecord, listTaskRecords, parseTaskRawJson } from '../storage/tasks.ts';
import { syncAgentRuntimeTasks } from '../sync/agent-runtime-sync.ts';
import { getTaskInputSchema, taskGetSchema, taskListSchema } from './contracts.ts';

export async function listTasks() {
    await refreshTaskState();
    const records = await listTaskRecords();

    return taskListSchema.parse({
        tasks: records.map((record) => parseTaskRawJson(record)),
    });
}

export async function getTask(input: unknown) {
    const parsed = getTaskInputSchema.parse(input);
    await refreshTaskState();
    const record = await getTaskRecord(parsed.taskId);

    return taskGetSchema.parse({
        task: record ? parseTaskRawJson(record) : null,
    });
}

async function refreshTaskState() {
    try {
        await syncAgentRuntimeTasks({ emitUpdates: false });
    } catch (error) {
        console.warn('[tavern] failed to refresh task state', error);
    }
}
