import { emitTasksUpdated } from '../api/invalidation-events.ts';
import { saveTaskRecord } from '../storage/tasks.ts';
import { dispatchTaskInputSchema, dispatchTaskResultSchema } from './contracts.ts';
import { requireActiveTaskRuntime } from './mutations.ts';

export async function dispatchTask(input: unknown) {
    const parsed = dispatchTaskInputSchema.parse(input);
    const { client, runtimeId } = await requireActiveTaskRuntime();
    const result = await client.dispatchTask(parsed.taskId, parsed.agentId);
    await saveTaskRecord({ runtimeId, task: result.task });
    emitTasksUpdated();
    return dispatchTaskResultSchema.parse(result);
}
