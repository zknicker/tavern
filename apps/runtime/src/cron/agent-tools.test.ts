import { describe, expect, test } from 'vitest';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat } from '../tavern/chat-api/index.ts';
import { createTavernCronTools } from './agent-tools.ts';
import { createAgentChat, setupCronTestLifecycle } from './cron-test-helpers.ts';
import { startRuntimeCronManager } from './scheduler.ts';
import { createCronJob, getCronJob, listCronJobs } from './store.ts';

describe('cron agent tools', () => {
    const cronTest = setupCronTestLifecycle();

    test('creates, lists, updates, and deletes the executing agent cron jobs', async () => {
        createAgentChat('agt_primary');
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        const tools = createTavernCronTools({ agentId: 'agt_primary' });

        const created = await runTool<Record<string, unknown>, { job: { id: string } }>(
            tools,
            'cron_create',
            {
                chatId: 'cht_general',
                message: 'Prepare the daily brief.',
                name: 'Daily brief',
                schedule: { everyMs: 60_000, kind: 'every' },
            }
        );
        const createdJobId = created.job.id;

        expect(created.job).toMatchObject({
            enabled: true,
            id: expect.stringMatching(/^crn_/u),
            name: 'Daily brief',
            nextRunAtMs: expect.any(Number),
            schedule: { everyMs: 60_000, kind: 'every' },
        });
        expect(getCronJob(createdJobId)).toMatchObject({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            payload: { kind: 'agentTurn', message: 'Prepare the daily brief.' },
        });

        await expect(runTool(tools, 'cron_list', {})).resolves.toMatchObject({
            jobs: [{ id: createdJobId, lastRunStatus: undefined }],
        });

        const updated = await runTool<Record<string, unknown>, { job: { id: string } }>(
            tools,
            'cron_update',
            {
                enabled: false,
                jobId: createdJobId,
                message: 'Prepare the paused brief.',
                name: 'Paused brief',
            }
        );

        expect(updated.job).toMatchObject({
            enabled: false,
            id: createdJobId,
            name: 'Paused brief',
            nextRunAtMs: undefined,
        });
        expect(getCronJob(createdJobId)).toMatchObject({
            payload: { kind: 'agentTurn', message: 'Prepare the paused brief.' },
        });

        await expect(runTool(tools, 'cron_delete', { jobId: createdJobId })).resolves.toEqual({
            deleted: true,
            id: createdJobId,
        });
        expect(getCronJob(createdJobId)).toBeNull();
    });

    test('keeps other agents jobs hidden and rejects cross-agent mutation', async () => {
        createAgentChat('agt_primary', 'agt_other');
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_primary',
            name: 'Primary job',
            payload: { kind: 'agentTurn', message: 'Only mine.' },
            schedule: { everyMs: 60_000, kind: 'every' },
        });
        const otherTools = createTavernCronTools({ agentId: 'agt_other' });

        await expect(runTool(otherTools, 'cron_list', {})).resolves.toEqual({ jobs: [] });
        await expect(
            runTool(otherTools, 'cron_update', { jobId: job.id, name: 'Hijack' })
        ).rejects.toThrow('Cron job not found for this agent.');
        await expect(runTool(otherTools, 'cron_delete', { jobId: job.id })).rejects.toThrow(
            'Cron job not found for this agent.'
        );
        expect(getCronJob(job.id)).toMatchObject({ name: 'Primary job' });
    });

    test('rejects delivery to chats where the executing agent does not participate', async () => {
        createAgentChat('agt_primary');
        createChat({
            id: 'cht_other',
            kind: 'channel',
            participants: [{ id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} }],
            title: 'Other',
        });
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );

        await expect(
            runTool(createTavernCronTools({ agentId: 'agt_primary' }), 'cron_create', {
                chatId: 'cht_other',
                message: 'This should not schedule.',
                name: 'Invalid delivery',
                schedule: { everyMs: 60_000, kind: 'every' },
            })
        ).rejects.toThrow('is not a participant');
        expect(listCronJobs()).toEqual([]);
    });

    test('rejects caller supplied ids on create', async () => {
        createAgentChat('agt_primary');
        cronTest.setManager(
            await startRuntimeCronManager({
                clearQueuesOnStop: true,
                jobsDatabasePath: cronTest.jobsDbPath(),
                queueName: cronTest.testQueueName(),
            })
        );

        await expect(
            runTool(createTavernCronTools({ agentId: 'agt_primary' }), 'cron_create', {
                chatId: 'cht_general',
                id: 'cron_user_supplied',
                message: 'No caller id.',
                name: 'Caller id',
                schedule: { everyMs: 60_000, kind: 'every' },
            })
        ).rejects.toThrow('Unrecognized key');
        expect(getCronJob('cron_user_supplied')).toBeNull();
    });

    test('reports cron unavailable when the scheduler is not running', async () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'Primary',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_primary',
            },
        });

        await expect(
            runTool(createTavernCronTools({ agentId: 'agt_primary' }), 'cron_list', {})
        ).rejects.toThrow('Cron is not available.');
    });
});

type ToolName = keyof ReturnType<typeof createTavernCronTools>;

async function runTool<Input, Output>(
    tools: ReturnType<typeof createTavernCronTools>,
    name: ToolName,
    input: Input
): Promise<Output> {
    const selected = tools[name] as unknown as {
        execute: (
            input: Input,
            options: { context: unknown; messages: []; toolCallId: string }
        ) => Output | PromiseLike<Output>;
    };
    return await selected.execute(input, {
        context: undefined,
        messages: [],
        toolCallId: `call_${String(name)}`,
    });
}
