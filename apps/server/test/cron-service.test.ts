import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as configuredClient from '../src/agent-runtime/configured-client.ts';
import * as agentRuntimeCron from '../src/agent-runtime/cron.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM cron_jobs; DELETE FROM agents;');
});

test('cron list returns summaries while get returns the full editable job', async () => {
    const cronJob = {
        agentId: 'agent:planner',
        createdAt: '2026-04-30T12:00:00.000Z',
        deleteAfterRun: false,
        delivery: null,
        description: 'Keep things moving.',
        enabled: true,
        id: 'tavern:cron:daily-standup',
        lastRunAt: null,
        name: 'Daily standup',
        nextRunAt: null,
        payload: {
            kind: 'agentTurn' as const,
            message: 'Post a daily standup update.',
        },
        schedule: {
            expr: '0 9 * * 1-5',
            kind: 'cron' as const,
        },
        state: {},
        updatedAt: '2026-04-30T12:00:00.000Z',
        wakeMode: 'now' as const,
    };
    spyOn(configuredClient, 'requireConfiguredAgentRuntimeClientForRuntimeId').mockResolvedValue(
        {} as never
    );
    spyOn(agentRuntimeCron, 'createCronJob').mockResolvedValue(cronJob);
    spyOn(agentRuntimeCron, 'listCronJobs').mockResolvedValue([cronJob]);
    spyOn(agentRuntimeCron, 'getCronJob').mockResolvedValue(cronJob);
    await syncAgentsForRuntime({
        agents: [
            {
                enabledSkillIds: [],
                id: 'agent:planner',
                isAdmin: false,
                name: 'Planner',
                primaryColor: null,
                workspaceFolder: 'planning',
            },
        ],
        runtimeId: 'runtime-1',
    });

    const cronService = await import('../src/cron/list.ts');
    const { createCronJob } = await import('../src/cron/create.ts');

    await createCronJob({
        agentId: 'agent:planner',
        description: 'Keep things moving.',
        name: 'Daily standup',
        payload: {
            kind: 'agentTurn',
            message: 'Post a daily standup update.',
        },
        scheduleConfig: {
            kind: 'weekdays',
            time: '09:00',
        },
        wakeMode: 'now',
    });

    const listed = await cronService.listCronJobs();
    const listedJob = listed.jobs[0];
    const loaded = await cronService.getCronJob({ jobId: listedJob?.id ?? '' });

    assert.ok(listedJob);
    assert.equal(listedJob.name, 'Daily standup');
    assert.equal(Object.hasOwn(listedJob, 'payload'), false);
    assert.ok(loaded.job);
    assert.equal(loaded.job.payload.kind, 'agentTurn');
    assert.equal(loaded.job.payload.message, 'Post a daily standup update.');
});
