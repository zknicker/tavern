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

export function publishLabelUpdated(labelId: string) {
    publishRuntimeEvent({
        labelId,
        timestamp: new Date().toISOString(),
        type: 'label.updated',
    });
}

export function publishLabelDeleted(labelId: string) {
    publishRuntimeEvent({
        labelId,
        timestamp: new Date().toISOString(),
        type: 'label.deleted',
    });
}
