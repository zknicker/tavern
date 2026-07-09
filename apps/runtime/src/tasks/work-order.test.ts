import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { setModelProviderEnabled } from '../models/provider-store.ts';
import type { AgentExecutor } from '../tavern/agent-executor.ts';
import {
    resetAgentExecutorForTesting,
    setAgentExecutorForTesting,
    stopAgentTurn,
} from '../tavern/agent-turn-runner.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { getChat, listMessages } from '../tavern/chat-api/index.ts';
import { promoteTaskAttachments } from './attachments.ts';
import { createTask, getTask, updateTask } from './store.ts';
import { dispatchTaskWorkOrder } from './work-order.ts';

describe('task work orders', () => {
    const originalCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
    const originalArtifactsRoot = process.env.TAVERN_TASK_ARTIFACTS_DIR;
    let tempRoot: string;

    beforeEach(async () => {
        tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'tavern-work-orders-'));
        process.env.TAVERN_TASK_ARTIFACTS_DIR = path.join(tempRoot, 'artifacts');
        ensureRuntimeSchema(initTestDb());
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        await storeAgent('agt_first', path.join(tempRoot, 'agt_first'));
        await storeAgent('agt_second', path.join(tempRoot, 'agt_second'));
        setAgentExecutorForTesting(hangingExecutor());
    });

    afterEach(async () => {
        resetAgentExecutorForTesting();
        closeDb();
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = originalCommand;
        restoreEnv('TAVERN_TASK_ARTIFACTS_DIR', originalArtifactsRoot);
        await fs.rm(tempRoot, { force: true, recursive: true });
    });

    test('manual and auto dispatch share a reusable task chat and bookkeeping path', async () => {
        const task = createTask({ id: 'tsk_shared', status: 'backlog', title: 'Shared path' });
        const manual = await dispatchTaskWorkOrder({
            agentId: 'agt_first',
            taskId: task.id,
            trigger: 'manual',
        });
        expect(manual.task).toMatchObject({
            assignee: { agentId: 'agt_first', kind: 'agent' },
            dispatchAttempts: 1,
            dispatchTrigger: 'manual',
            status: 'in_progress',
        });
        expect(manual.task.activeDispatchRunId).toMatch(/^run_/u);
        await stopAgentTurn(manual.task.activeDispatchRunId ?? '');

        updateTask(task.id, {
            assignee: { agentId: 'agt_second', kind: 'agent' },
            status: 'todo',
        });
        const automatic = await dispatchTaskWorkOrder({
            agentId: 'agt_second',
            taskId: task.id,
            trigger: 'auto',
        });
        expect(automatic.chatId).toBe(manual.chatId);
        expect(automatic.task).toMatchObject({
            assignee: { agentId: 'agt_second', kind: 'agent' },
            // The human requeue into todo reset the attempt counter.
            dispatchAttempts: 1,
            dispatchTrigger: 'auto',
            status: 'in_progress',
        });
        expect(
            getChat(manual.chatId)
                ?.participants.filter((participant) => participant.kind === 'agent')
                .map((participant) => participant.id)
        ).toEqual(['agt_first', 'agt_second']);
        await stopAgentTurn(automatic.task.activeDispatchRunId ?? '');
        expect(getTask(task.id)?.activeDispatchRunId).toBeNull();
    });

    test('materializes prior attachments before sending the work order', async () => {
        const task = createTask({ id: 'tsk_rework', status: 'backlog', title: 'Rework file' });
        const source = path.join(tempRoot, 'agt_first', 'workbench/tasks/T-1/output.txt');
        await fs.mkdir(path.dirname(source), { recursive: true });
        await fs.writeFile(source, 'prior deliverable');
        await promoteTaskAttachments({
            agentId: 'agt_first',
            paths: ['workbench/tasks/T-1/output.txt'],
            taskId: task.id,
        });

        const dispatched = await dispatchTaskWorkOrder({
            agentId: 'agt_second',
            taskId: task.id,
            trigger: 'manual',
        });
        expect(
            await fs.readFile(
                path.join(tempRoot, 'agt_second', 'workbench/tasks/T-1/output.txt'),
                'utf8'
            )
        ).toBe('prior deliverable');
        expect(listMessages(dispatched.chatId).messages[0]?.content).toContain(
            'Prior deliverables are in workbench/tasks/T-1/: output.txt.'
        );
        await stopAgentTurn(dispatched.task.activeDispatchRunId ?? '');
    });
});

async function storeAgent(id: string, workspaceFolder: string) {
    await fs.mkdir(workspaceFolder, { recursive: true });
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id,
            isAdmin: false,
            name: id,
            primaryColor: null,
            workspaceFolder,
        },
    });
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

function hangingExecutor(): AgentExecutor {
    return {
        execute: () => new Promise(() => {}),
        stop: () => true,
    };
}
