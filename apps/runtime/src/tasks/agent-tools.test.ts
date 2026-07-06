import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createTavernTaskTools } from './agent-tools.ts';
import { createTaskId } from './ids.ts';
import { createTask, getTask } from './store.ts';

describe('tasks agent tools', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        storeTestAgent('agt_primary');
        storeTestAgent('agt_other');
    });

    afterEach(() => {
        closeDb();
    });

    test('creates, lists, reads, and updates tasks', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            {
                description: 'Fix the invite email link.',
                priority: 'high',
                title: 'Fix invite link',
            }
        );
        expect(created.task).toMatchObject({
            number: 'T-1',
            priority: 'high',
            status: 'backlog',
            title: 'Fix invite link',
        });

        const listed = await runTool<Record<string, unknown>, { tasks: ToolTask[] }>(
            tools,
            'tasks_list',
            {}
        );
        expect(listed.tasks).toHaveLength(1);

        const read = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_get',
            { number: 1 }
        );
        expect(read.task.description).toBe('Fix the invite email link.');

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            { assignToMe: true, number: 1, status: 'done' }
        );
        expect(updated.task).toMatchObject({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            status: 'done',
        });
    });

    test('filters the list to tasks assigned to the executing agent', async () => {
        createTask({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            id: createTaskId(),
            title: 'Mine',
        });
        createTask({
            assignee: { agentId: 'agt_other', kind: 'agent' },
            id: createTaskId(),
            title: 'Someone else',
        });

        const tools = createTavernTaskTools({ agentId: 'agt_primary' });
        const listed = await runTool<Record<string, unknown>, { tasks: ToolTask[] }>(
            tools,
            'tasks_list',
            { assignedToMe: true }
        );
        expect(listed.tasks).toHaveLength(1);
        expect(listed.tasks[0]?.title).toBe('Mine');
    });

    test('rejects reads without a task reference and publishes updates that persist', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });
        await expect(runTool(tools, 'tasks_get', {})).rejects.toThrow();

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            { title: 'Persist me' }
        );
        expect(getTask(created.task.id)?.title).toBe('Persist me');
    });
});

function storeTestAgent(agentId: string) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: agentId,
            isAdmin: false,
            name: agentId,
            primaryColor: null,
            workspaceFolder: `/tmp/${agentId}`,
        },
    });
}

interface ToolTask {
    assignee: unknown;
    description?: string | null;
    id: string;
    number: string;
    priority: string;
    status: string;
    title: string;
}

type ToolName = keyof ReturnType<typeof createTavernTaskTools>;

async function runTool<Input, Output>(
    tools: ReturnType<typeof createTavernTaskTools>,
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
