import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function publishTaskUpdated(taskId: string) {
    publishRuntimeEvent({
        taskId,
        timestamp: new Date().toISOString(),
        type: 'task.updated',
    });
}

export function publishTaskDeleted(taskId: string) {
    publishRuntimeEvent({
        taskId,
        timestamp: new Date().toISOString(),
        type: 'task.deleted',
    });
}
