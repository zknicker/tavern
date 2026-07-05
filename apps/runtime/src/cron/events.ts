import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function publishCronUpdated(cronJobId: string) {
    publishRuntimeEvent({
        cronJobId,
        timestamp: new Date().toISOString(),
        type: 'cron.updated',
    });
}

export function publishCronDeleted(cronJobId: string) {
    publishRuntimeEvent({
        cronJobId,
        timestamp: new Date().toISOString(),
        type: 'cron.deleted',
    });
}
