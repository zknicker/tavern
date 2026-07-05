import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { buildCronList, formatCronErrorMessage } from './cron-list-data.ts';

afterEach(() => {
    mock.restore();
});

describe('buildCronList', () => {
    test('uses cron job state for summary fields', () => {
        spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-16T12:10:00.000Z'));

        const [job] = buildCronList([
            {
                agentId: 'agent:planner',
                description: 'Daily standup',
                enabled: true,
                id: 'cron:standup',
                name: 'Standup',
                schedule: {
                    expr: '0 9 * * 1-5',
                    kind: 'cron' as const,
                },
                state: {
                    lastRunAtMs: Date.parse('2026-04-16T12:00:00.000Z'),
                    lastRunStatus: 'success' as const,
                    nextRunAtMs: Date.parse('2026-04-17T12:00:00.000Z'),
                },
                updatedAt: '2026-04-16T12:00:00.000Z',
            },
        ]);

        expect(job?.channelId).toBe('agent:planner');
        expect(job?.lastRun).toBe('10m ago');
        expect(job?.nextRun).toBe('Apr 17 at 12:00 PM');
        expect(job?.successRate).toBe('success');
        expect(job?.executions).toEqual([]);
    });

    test('extracts readable cron failure messages from provider wrappers', () => {
        expect(
            formatCronErrorMessage(
                "RuntimeError: Error code: 400 - {'error': {'message': \"You are out of extra usage.\"}}"
            )
        ).toBe('You are out of extra usage.');
        expect(formatCronErrorMessage('Provider timeout')).toBe('Provider timeout');
        expect(formatCronErrorMessage('   ')).toBeNull();
    });

    test('carries last job error detail for failed list rows', () => {
        const [job] = buildCronList([
            {
                agentId: 'agent:planner',
                description: 'Daily standup',
                enabled: true,
                id: 'cron:standup',
                name: 'Standup',
                schedule: {
                    expr: '0 9 * * 1-5',
                    kind: 'cron' as const,
                },
                state: {
                    lastErrorCode: 'execution_failed' as const,
                    lastErrorMessage:
                        "RuntimeError: Error code: 400 - {'error': {'message': \"You are out of extra usage.\"}}",
                    lastRunAtMs: Date.parse('2026-04-16T12:00:00.000Z'),
                    lastRunStatus: 'error' as const,
                },
                updatedAt: '2026-04-16T12:00:00.000Z',
            },
        ]);

        expect(job?.lastErrorMessage).toBe('You are out of extra usage.');
        expect(job?.lastErrorRaw).toContain('RuntimeError');
        expect(job?.successRate).toBe('error');
    });

    test('groups real cron runs by job and preserves chat turn links', () => {
        spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-16T12:10:00.000Z'));

        const jobs = [
            {
                agentId: 'agent:planner',
                description: 'Daily standup',
                enabled: true,
                id: 'cron:standup',
                name: 'Standup',
                schedule: {
                    expr: '0 9 * * 1-5',
                    kind: 'cron' as const,
                },
                state: {},
                updatedAt: '2026-04-16T12:00:00.000Z',
            },
        ];
        const runs = [
            {
                chatId: 'chat:standup',
                executionErrorCode: null,
                executionErrorMessage: null,
                finishedAt: '2026-04-16T12:01:30.000Z',
                id: 'run:newer',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-16T12:01:00.000Z',
                startedAt: '2026-04-16T12:01:05.000Z',
                status: 'success' as const,
                trigger: 'manual' as const,
                turnId: 'turn:newer',
            },
            {
                chatId: null,
                executionErrorCode: 'execution_failed' as const,
                executionErrorMessage: 'Provider timeout',
                finishedAt: '2026-04-16T11:01:30.000Z',
                id: 'run:older',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-16T11:01:00.000Z',
                startedAt: '2026-04-16T11:01:05.000Z',
                status: 'error' as const,
                trigger: 'schedule' as const,
                turnId: null,
            },
        ];

        const [job] = buildCronList(jobs, runs);

        expect(job?.executions.map((execution) => execution.id)).toEqual([
            'run:newer',
            'run:older',
        ]);
        expect(job?.executions[0]?.chatId).toBe('chat:standup');
        expect(job?.executions[0]?.turnId).toBe('turn:newer');
        expect(job?.executions[1]?.status).toBe('error');
    });
});
