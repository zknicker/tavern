import { expect, test } from 'bun:test';
import { formatCronRunDetail } from './cron-run-view-data.ts';

test('formatCronRunDetail keeps failed run errors readable', () => {
    expect(
        formatCronRunDetail({
            chatId: null,
            executionErrorCode: 'execution_failed',
            executionErrorMessage:
                "RuntimeError: Error code: 400 - {'message': \"You're out of extra usage.\"}",
            finishedAt: '2026-06-16T13:00:42.659Z',
            id: 'state:cron:good-morning:1781614842659',
            jobId: 'cron:good-morning',
            scheduledFor: '2026-06-16T13:00:42.659Z',
            startedAt: '2026-06-16T13:00:42.659Z',
            status: 'error',
            trigger: 'schedule',
            turnId: null,
        })
    ).toBe("You're out of extra usage.");
});
