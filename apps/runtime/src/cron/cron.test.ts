import { agentRuntimeRoutes } from '@tavern/api';
import { describe, expect, test, vi } from 'vitest';
import { getDb } from '../db/connection.ts';
import { setAgentExecutorForTesting } from '../tavern/agent-turn-runner.ts';
import { listAgentTurnsForSession } from '../tavern/agent-turn-store.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { listMessages } from '../tavern/chat-api/index.ts';
import { handleTavernRuntimeRequest } from '../tavern/router.ts';
import {
    createAgentChat,
    createFakeAgentExecutor,
    getRequest,
    jsonRequest,
    setupCronTestLifecycle,
    waitFor,
} from './cron-test-helpers.ts';
import { executeCronJob } from './executor.ts';
import { nextRunAtFromSchedule } from './schedule.ts';
import { computeCronScheduleNextRunAtMs, startRuntimeCronManager } from './scheduler.ts';
import {
    createCronJob,
    createCronRun,
    getCronJob,
    listCronRuns,
    markCronJobRunning,
    setCronJobNextRunAt,
    updateCronRun,
} from './store.ts';

describe('Runtime cron', () => {
    const cronTest = setupCronTestLifecycle();

    test('evaluates at, every, and cron schedules with timezone support', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));

        expect(nextRunAtFromSchedule({ at: '2026-07-05T12:30:00.000Z', kind: 'at' })).toBe(
            Date.parse('2026-07-05T12:30:00.000Z')
        );
        expect(nextRunAtFromSchedule({ everyMs: 15_000, kind: 'every' })).toBe(
            Date.parse('2026-07-05T12:00:15.000Z')
        );

        const utc = await computeCronScheduleNextRunAtMs({
            jobsDatabasePath: cronTest.jobsDbPath(),
            schedule: { expr: '0 0 9 * * *', kind: 'cron' },
        });
        const newYork = await computeCronScheduleNextRunAtMs({
            jobsDatabasePath: cronTest.jobsDbPath(),
            schedule: { expr: '0 0 9 * * *', kind: 'cron', tz: 'America/New_York' },
        });

        expect(new Date(utc ?? 0).toISOString()).toBe('2026-07-06T09:00:00.000Z');
        expect(new Date(newYork ?? 0).toISOString()).toBe('2026-07-05T13:00:00.000Z');
    });

    test('round-trips cron CRUD through Runtime HTTP routes', async () => {
        createAgentChat('agt_primary');
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );

        const createResponse = await handleTavernRuntimeRequest(
            jsonRequest(agentRuntimeRoutes.cronJobs, {
                agentId: 'agt_primary',
                delivery: { chatId: 'cht_general' },
                id: 'cron_daily',
                name: 'Daily note',
                payload: { kind: 'systemEvent', text: 'Cron hello' },
                schedule: { everyMs: 3_600_000, kind: 'every' },
            })
        );
        expect(createResponse.status).toBe(201);
        const created = (await createResponse.json()) as { state: { nextRunAtMs?: number } };
        expect(created).toMatchObject({
            delivery: { chatId: 'cht_general' },
            id: 'cron_daily',
            payload: { kind: 'systemEvent', text: 'Cron hello' },
        });
        expect(created.state.nextRunAtMs).toEqual(expect.any(Number));

        const listResponse = await handleTavernRuntimeRequest(
            getRequest(agentRuntimeRoutes.cronJobs)
        );
        await expect(listResponse.json()).resolves.toMatchObject({
            jobs: [{ id: 'cron_daily', state: { nextRunAtMs: expect.any(Number) } }],
        });

        const patchResponse = await handleTavernRuntimeRequest(
            jsonRequest(
                agentRuntimeRoutes.cronJob('cron_daily'),
                {
                    enabled: false,
                    name: 'Paused note',
                },
                'PATCH'
            )
        );
        await expect(patchResponse.json()).resolves.toMatchObject({
            enabled: false,
            id: 'cron_daily',
            name: 'Paused note',
        });

        const deleteResponse = await handleTavernRuntimeRequest(
            getRequest(agentRuntimeRoutes.cronJob('cron_daily'), 'DELETE')
        );
        await expect(deleteResponse.json()).resolves.toEqual({ archived: true, id: 'cron_daily' });

        const cronKindResponse = await handleTavernRuntimeRequest(
            jsonRequest(agentRuntimeRoutes.cronJobs, {
                agentId: 'agt_primary',
                delivery: { chatId: 'cht_general' },
                id: 'cron_pattern',
                name: 'Pattern next run',
                payload: { kind: 'systemEvent', text: 'Cron hello' },
                schedule: { expr: '0 9 * * *', kind: 'cron', tz: 'America/New_York' },
            })
        );
        const cronKind = (await cronKindResponse.json()) as { state: { nextRunAtMs?: number } };
        // The embedded scheduler upsert reports a placeholder next (now+60s);
        // the stored next run must come from the real cron pattern instead.
        expect(cronKind.state.nextRunAtMs).toBe(
            nextRunAtFromSchedule({ expr: '0 9 * * *', kind: 'cron', tz: 'America/New_York' })
        );
        expect(cronKind.state.nextRunAtMs).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
    });

    test('rejects creation when the agent is not in the delivery chat and fails invalid delivery at run time', async () => {
        createAgentChat('agt_primary');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_other',
                isAdmin: false,
                name: 'Other',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_other',
            },
        });

        const response = await handleTavernRuntimeRequest(
            jsonRequest(agentRuntimeRoutes.cronJobs, {
                agentId: 'agt_other',
                delivery: { chatId: 'cht_general' },
                id: 'cron_invalid',
                name: 'Invalid',
                payload: { kind: 'systemEvent', text: 'Nope' },
                schedule: { everyMs: 60_000, kind: 'every' },
            })
        );
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            message: expect.stringContaining('is not a participant'),
        });

        const job = createCronJob({
            agentId: 'agt_other',
            delivery: { chatId: 'cht_general' },
            id: 'cron_runtime_invalid',
            name: 'Invalid at run',
            payload: { kind: 'systemEvent', text: 'Nope' },
            schedule: { everyMs: 60_000, kind: 'every' },
        });
        const run = await executeCronJob({
            jobId: job.id,
            scheduledFor: '2026-07-05T12:00:00.000Z',
            trigger: 'manual',
        });

        expect(run).toMatchObject({
            executionErrorCode: 'execution_failed',
            executionErrorMessage: expect.stringContaining('is not a participant'),
            status: 'error',
        });
    });

    test('runs an agentTurn cron in the delivery chat and tracks state through completion', async () => {
        createAgentChat('agt_primary');
        setAgentExecutorForTesting(createFakeAgentExecutor());
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_turn',
            name: 'Agent turn',
            payload: { kind: 'agentTurn', message: 'Summarize the day.' },
            schedule: { everyMs: 60_000, kind: 'every' },
        });

        const run = await executeCronJob({
            jobId: job.id,
            scheduledFor: '2026-07-05T12:00:00.000Z',
            trigger: 'manual',
        });

        expect(run.status).toBe('success');
        expect(run.turnId).toMatch(/^run_/);
        expect(getCronJob(job.id)?.state).toMatchObject({
            consecutiveErrors: 0,
            lastRunStatus: 'success',
        });
        expect(listAgentTurnsForSession('ags_agt_primary_1')[0]).toMatchObject({
            id: run.turnId,
            status: 'completed',
        });
        expect(listMessages('cht_general').messages.map((message) => message.role)).toEqual([
            'user',
            'assistant',
        ]);
    });

    test('runs a systemEvent cron as an agent-authored message with no turn', async () => {
        createAgentChat('agt_primary');
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_system',
            name: 'System event',
            payload: { kind: 'systemEvent', text: 'Standup starts now.' },
            schedule: { everyMs: 60_000, kind: 'every' },
        });

        const run = await executeCronJob({
            jobId: job.id,
            scheduledFor: '2026-07-05T12:00:00.000Z',
            trigger: 'manual',
        });

        expect(run).toMatchObject({ status: 'success', turnId: null });
        expect(listMessages('cht_general').messages).toMatchObject([
            {
                author: { id: 'agt_primary' },
                content: 'Standup starts now.',
                role: 'assistant',
            },
        ]);
        expect(
            getDb().prepare('SELECT COUNT(*) AS count FROM agent_turns').get() as { count: number }
        ).toEqual({ count: 0 });
    });

    test('runs one missed window on startup recovery', async () => {
        createAgentChat('agt_primary');
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_recovery',
            name: 'Recover me',
            payload: { kind: 'systemEvent', text: 'Recovered.' },
            schedule: { everyMs: 3_600_000, kind: 'every' },
        });
        setCronJobNextRunAt(job.id, Date.parse('2026-07-05T10:00:00.000Z'));

        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        await waitFor(() => listCronRuns(job.id).length === 1);
        expect(listCronRuns(job.id)).toMatchObject([{ status: 'success', trigger: 'recovery' }]);

        await cronTest.stopManager();
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(listCronRuns(job.id)).toHaveLength(1);
    });

    test('rejects invalid cron expressions and timezones before persisting the job', async () => {
        createAgentChat('agt_primary');

        const badExpr = await handleTavernRuntimeRequest(
            jsonRequest(agentRuntimeRoutes.cronJobs, {
                agentId: 'agt_primary',
                delivery: { chatId: 'cht_general' },
                id: 'cron_bad_expr',
                name: 'Bad expr',
                payload: { kind: 'systemEvent', text: 'Nope' },
                schedule: { expr: 'not a cron', kind: 'cron' },
            })
        );
        expect(badExpr.status).toBe(400);

        const badTz = await handleTavernRuntimeRequest(
            jsonRequest(agentRuntimeRoutes.cronJobs, {
                agentId: 'agt_primary',
                delivery: { chatId: 'cht_general' },
                id: 'cron_bad_tz',
                name: 'Bad tz',
                payload: { kind: 'systemEvent', text: 'Nope' },
                schedule: { expr: '0 9 * * *', kind: 'cron', tz: 'Mars/Olympus' },
            })
        );
        expect(badTz.status).toBe(400);

        expect(getCronJob('cron_bad_expr')).toBeNull();
        expect(getCronJob('cron_bad_tz')).toBeNull();
    });

    test('recovers again when a new window is missed after an earlier recovery', async () => {
        createAgentChat('agt_primary');
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_recovery_again',
            name: 'Recover twice',
            payload: { kind: 'systemEvent', text: 'Recovered.' },
            schedule: { everyMs: 3_600_000, kind: 'every' },
        });
        setCronJobNextRunAt(job.id, Date.parse('2026-07-05T10:00:00.000Z'));

        // Queue state persists across the restart, matching production.
        cronTest.setManager(
            await startRuntimeCronManager({
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        await waitFor(() => listCronRuns(job.id).length === 1);
        await cronTest.stopManager();

        setCronJobNextRunAt(job.id, Date.parse('2026-07-05T11:00:00.000Z'));
        cronTest.setManager(
            await startRuntimeCronManager({
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        await waitFor(() => listCronRuns(job.id).length === 2);
        expect(listCronRuns(job.id).map((run) => run.trigger)).toEqual(['recovery', 'recovery']);
    });

    test('settles runs orphaned by a restart as control-plane errors', async () => {
        createAgentChat('agt_primary');
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_orphan',
            name: 'Orphaned',
            payload: { kind: 'systemEvent', text: 'Never lands.' },
            schedule: { everyMs: 3_600_000, kind: 'every' },
        });
        const orphan = createCronRun({
            jobId: job.id,
            scheduledFor: '2026-07-05T11:00:00.000Z',
            trigger: 'schedule',
        });
        updateCronRun(orphan.id, { startedAt: '2026-07-05T11:00:00.000Z', status: 'running' });
        markCronJobRunning(job.id, Date.parse('2026-07-05T11:00:00.000Z'));

        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );

        expect(listCronRuns(job.id)).toMatchObject([
            {
                executionErrorCode: 'control_plane_restarted',
                finishedAt: expect.any(String),
                status: 'error',
            },
        ]);
        expect(getCronJob(job.id)?.state.runningAtMs).toBeUndefined();
    });

    test('deleteAfterRun removes the job after a completed run', async () => {
        createAgentChat('agt_primary');
        createCronJob({
            agentId: 'agt_primary',
            deleteAfterRun: true,
            delivery: { chatId: 'cht_general' },
            id: 'cron_delete_after',
            name: 'Delete after',
            payload: { kind: 'systemEvent', text: 'One shot.' },
            schedule: { at: '2026-07-05T12:00:00.000Z', kind: 'at' },
        });

        const run = await executeCronJob({
            jobId: 'cron_delete_after',
            scheduledFor: '2026-07-05T12:00:00.000Z',
            trigger: 'manual',
        });

        expect(run.status).toBe('success');
        expect(getCronJob('cron_delete_after')).toBeNull();
    });
});
