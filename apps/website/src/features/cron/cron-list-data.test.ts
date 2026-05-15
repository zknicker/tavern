import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { buildCronList } from './cron-list-data.ts';

afterEach(() => {
    mock.restore();
});

describe('buildCronList', () => {
    test('uses cron job state for summary fields without requiring session inference', () => {
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
                state: {
                    lastRunAtMs: Date.parse('2026-04-16T12:00:00.000Z'),
                    lastStatus: 'success' as const,
                },
                updatedAt: '2026-04-16T12:00:00.000Z',
            },
        ];

        const [job] = buildCronList(jobs);

        expect(job?.channelId).toBe('agent:planner');
        expect(job?.lastRun).toBe('10m ago');
        expect(job?.successRate).toBe('success');
        expect(job?.executions).toEqual([]);
    });

    test('builds list rows without requiring a job-scoped cron session', () => {
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
                state: {},
                updatedAt: '2026-04-16T12:00:00.000Z',
            },
        ]);

        expect(job?.channelId).toBe('agent:planner');
    });

    test('groups real cron runs by job and preserves session drill-through keys', () => {
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
                deliveryError: null,
                deliveryStatus: 'delivered' as const,
                executionErrorCode: null,
                executionErrorMessage: null,
                finishedAt: '2026-04-16T12:01:30.000Z',
                id: 'run:newer',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-16T12:01:00.000Z',
                sessionId: 'session-2',
                sessionKey: 'agent:planner:cron:standup:2',
                startedAt: '2026-04-16T12:01:05.000Z',
                status: 'success' as const,
                summary: 'Posted today’s update.',
                trigger: 'manual' as const,
            },
            {
                deliveryError: null,
                deliveryStatus: 'not_applicable' as const,
                executionErrorCode: 'execution_failed' as const,
                executionErrorMessage: 'Provider timeout',
                finishedAt: '2026-04-16T11:01:30.000Z',
                id: 'run:older',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-16T11:01:00.000Z',
                sessionId: null,
                sessionKey: null,
                startedAt: '2026-04-16T11:01:05.000Z',
                status: 'error' as const,
                summary: null,
                trigger: 'schedule' as const,
            },
        ];

        const [job] = buildCronList(jobs, runs);

        expect(job?.executions.map((execution) => execution.id)).toEqual([
            'run:newer',
            'run:older',
        ]);
        expect(job?.executions[0]?.sessionKey).toBe('agent:planner:cron:standup:2');
        expect(job?.executions[0]?.status).toBe('success');
        expect(job?.executions[1]?.status).toBe('error');
    });

    test('uses finished time for terminal cron activity ordering', () => {
        spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-18T18:01:00.000Z'));

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
                updatedAt: '2026-04-18T18:00:00.000Z',
            },
        ];
        const runs = [
            {
                deliveryError: null,
                deliveryStatus: 'not_applicable' as const,
                executionErrorCode: 'control_plane_restarted' as const,
                executionErrorMessage: 'Interrupted by agent runtime restart.',
                finishedAt: '2026-04-18T18:00:00.000Z',
                id: 'run:recovered',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-18T17:50:00.000Z',
                sessionId: null,
                sessionKey: null,
                startedAt: '2026-04-18T17:50:10.000Z',
                status: 'error' as const,
                summary: 'Interrupted by agent runtime restart.',
                trigger: 'schedule' as const,
            },
            {
                deliveryError: null,
                deliveryStatus: 'delivered' as const,
                executionErrorCode: null,
                executionErrorMessage: null,
                finishedAt: '2026-04-18T17:59:30.000Z',
                id: 'run:recent-success',
                jobId: 'cron:standup',
                scheduledFor: '2026-04-18T17:59:00.000Z',
                sessionId: 'session-1',
                sessionKey: 'session-1',
                startedAt: '2026-04-18T17:59:05.000Z',
                status: 'success' as const,
                summary: 'Posted today’s update.',
                trigger: 'manual' as const,
            },
        ];

        const [job] = buildCronList(jobs, runs);

        expect(job?.executions.map((execution) => execution.id)).toEqual([
            'run:recovered',
            'run:recent-success',
        ]);
        expect(job?.executions[0]?.occurredAt).toBe('2026-04-18T18:00:00.000Z');
    });
});
