import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { getDb } from '../db/connection.ts';
import { setAgentExecutorForTesting } from '../tavern/agent-turn-runner.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { listMessages } from '../tavern/chat-api/index.ts';
import {
    createAgentChat,
    createFakeAgentExecutor,
    setupCronTestLifecycle,
} from './cron-test-helpers.ts';
import { executeCronJob } from './executor.ts';
import { runCronScript } from './script-runner.ts';
import { createCronJob, getCronJob } from './store.ts';

describe('Runtime script cron', () => {
    setupCronTestLifecycle();
    const workspaces: string[] = [];

    afterAll(async () => {
        await Promise.all(workspaces.map((dir) => fs.rm(dir, { force: true, recursive: true })));
    });

    async function createScriptJob(input: { command: string; workingDir?: string }) {
        createAgentChat('agt_primary');
        const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-script-cron-'));
        workspaces.push(workspace);
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'agt_primary',
                primaryColor: null,
                workspaceFolder: workspace,
            },
        });
        const job = createCronJob({
            agentId: 'agt_primary',
            delivery: { chatId: 'cht_general' },
            id: 'cron_script',
            name: 'Watchdog',
            payload: { command: input.command, kind: 'script', workingDir: input.workingDir },
            schedule: { everyMs: 60_000, kind: 'every' },
        });
        return { job, workspace };
    }

    function runJob(jobId: string) {
        return executeCronJob({
            jobId,
            scheduledFor: '2026-07-05T12:00:00.000Z',
            trigger: 'manual',
        });
    }

    test('records a quiet tick for empty stdout without posting or dispatching a turn', async () => {
        const { job } = await createScriptJob({ command: 'true' });

        const run = await runJob(job.id);

        expect(run).toMatchObject({
            quiet: true,
            scriptExitCode: 0,
            scriptStderr: null,
            status: 'success',
            turnId: null,
        });
        expect(listMessages('cht_general').messages).toEqual([]);
        expect(
            getDb().prepare('SELECT COUNT(*) AS count FROM agent_turns').get() as { count: number }
        ).toEqual({ count: 0 });
        expect(getCronJob(job.id)?.state).toMatchObject({
            consecutiveErrors: 0,
            lastRunStatus: 'success',
        });
    });

    test('treats a wakeAgent:false sentinel as a quiet tick', async () => {
        const { job } = await createScriptJob({
            command: 'echo \'{"wakeAgent": false, "checked": 3}\'',
        });

        const run = await runJob(job.id);

        expect(run).toMatchObject({ quiet: true, status: 'success', turnId: null });
        expect(listMessages('cht_general').messages).toEqual([]);
    });

    test('delivers non-empty stdout as the automation message and dispatches an agent turn', async () => {
        setAgentExecutorForTesting(createFakeAgentExecutor());
        const { job } = await createScriptJob({ command: 'echo "3 new orders"' });

        const run = await runJob(job.id);

        expect(run).toMatchObject({
            quiet: false,
            scriptExitCode: 0,
            status: 'success',
        });
        expect(run.turnId).toMatch(/^run_/);
        const messages = listMessages('cht_general').messages;
        expect(messages[0]).toMatchObject({ content: '3 new orders', role: 'user' });
        expect(messages[1]).toMatchObject({ role: 'assistant' });
    });

    test('records a non-zero exit as an error run with exit code and stderr, posting nothing', async () => {
        const { job } = await createScriptJob({ command: 'echo "feed unreachable" >&2; exit 3' });

        const run = await runJob(job.id);

        expect(run).toMatchObject({
            executionErrorCode: 'execution_failed',
            executionErrorMessage: 'Script exited with code 3: feed unreachable',
            quiet: false,
            scriptExitCode: 3,
            status: 'error',
            turnId: null,
        });
        expect(run.scriptStderr).toContain('feed unreachable');
        expect(listMessages('cht_general').messages).toEqual([]);
        expect(getCronJob(job.id)?.state).toMatchObject({
            consecutiveErrors: 1,
            lastRunStatus: 'error',
        });
    });

    test('resolves a relative workingDir under the agent workspace', async () => {
        setAgentExecutorForTesting(createFakeAgentExecutor());
        const { job, workspace } = await createScriptJob({ command: 'pwd', workingDir: 'sub' });
        await fs.mkdir(path.join(workspace, 'sub'), { recursive: true });

        const run = await runJob(job.id);

        expect(run.status).toBe('success');
        const delivered = listMessages('cht_general').messages[0];
        expect(delivered?.content).toBe(await fs.realpath(path.join(workspace, 'sub')));
    });

    test('kills scripts that exceed the runtime cap and caps captured output', async () => {
        const timedOut = await runCronScript({
            command: 'sleep 5',
            cwd: os.tmpdir(),
            timeoutMs: 100,
        });
        expect(timedOut.timedOut).toBe(true);

        const capped = await runCronScript({
            command: 'printf "%01000d" 0; echo tail',
            cwd: os.tmpdir(),
            maxStdoutBytes: 64,
        });
        expect(capped.exitCode).toBe(0);
        expect(capped.stdout).toHaveLength(64 + '\n…[output truncated]'.length);
        expect(capped.stdout.endsWith('…[output truncated]')).toBe(true);
    });
});
