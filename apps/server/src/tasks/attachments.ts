import { emitTasksUpdated } from '../api/invalidation-events.ts';
import { syncAgentRuntimeTasks } from '../sync/agent-runtime-sync.ts';
import { taskAttachmentInputSchema } from './contracts.ts';
import { requireActiveTaskRuntime } from './mutations.ts';

export async function getTaskAttachment(input: unknown) {
    const parsed = taskAttachmentInputSchema.parse(input);
    const { client } = await requireActiveTaskRuntime();
    return await client.getTaskAttachment(parsed.taskId, parsed.attachmentId);
}

export async function deleteTaskAttachment(input: unknown) {
    const parsed = taskAttachmentInputSchema.parse(input);
    const { client } = await requireActiveTaskRuntime();
    await client.deleteTaskAttachment(parsed.taskId, parsed.attachmentId);
    refreshTasksInBackground();
    emitTasksUpdated();
    return { attachmentId: parsed.attachmentId, deleted: true as const };
}

function refreshTasksInBackground() {
    void syncAgentRuntimeTasks().catch((error) => {
        console.warn('[tavern] failed to refresh task records after attachment delete', error);
    });
}
