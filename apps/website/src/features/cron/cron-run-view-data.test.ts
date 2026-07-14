import { expect, test } from 'bun:test';
import { formatCronRunDetail, formatCronRunOutcome, isQuietCronRun } from './cron-run-view-data.ts';

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
            quiet: false,
            scheduledFor: '2026-06-16T13:00:42.659Z',
            scriptExitCode: null,
            scriptStderr: null,
            startedAt: '2026-06-16T13:00:42.659Z',
            status: 'error',
            trigger: 'schedule',
            turnId: null,
        })
    ).toBe("You're out of extra usage.");
});

test('quiet script runs read as Quiet instead of Success', () => {
    const quietRun = {
        chatId: 'cht_general',
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: '2026-06-16T13:00:43.000Z',
        id: 'run:quiet',
        jobId: 'cron:watchdog',
        quiet: true,
        scheduledFor: '2026-06-16T13:00:42.659Z',
        scriptExitCode: 0,
        scriptStderr: null,
        startedAt: '2026-06-16T13:00:42.659Z',
        status: 'success' as const,
        trigger: 'schedule' as const,
        turnId: null,
    };

    expect(isQuietCronRun(quietRun)).toBe(true);
    expect(formatCronRunOutcome(quietRun)).toBe('Quiet');
    expect(formatCronRunOutcome({ ...quietRun, quiet: false })).toBe('Success');
});
