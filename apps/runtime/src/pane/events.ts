import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function publishPaneUpdated(chatId: string, revision: number) {
    publishRuntimeEvent({
        chatId,
        revision,
        timestamp: new Date().toISOString(),
        type: 'pane.updated',
    });
}
