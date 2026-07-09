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
import { getChat } from '../tavern/chat-api/index.ts';
import { createTask, getTask, updateTask } from './store.ts';
import { dispatchTaskWorkOrder } from './work-order.ts';

describe('task work orders', () => {
    const originalCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        storeAgent('agt_first');
        storeAgent('agt_second');
        setAgentExecutorForTesting(hangingExecutor());
    });

    afterEach(() => {
        resetAgentExecutorForTesting();
        closeDb();
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = originalCommand;
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
});

function storeAgent(id: string) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id,
            isAdmin: false,
            name: id,
            primaryColor: null,
            workspaceFolder: `/tmp/${id}`,
        },
    });
}

function hangingExecutor(): AgentExecutor {
    return {
        execute: () => new Promise(() => {}),
        stop: () => true,
    };
}
