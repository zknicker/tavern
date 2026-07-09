import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createTavernTaskTools } from './agent-tools.ts';
import { createTask, getTask, updateTask } from './store.ts';

describe('task review policy', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_review',
                isAdmin: false,
                name: 'Reviewer',
                primaryColor: null,
                taskReviewPolicy: true,
                workspaceFolder: '/tmp/agt_review',
            },
        });
    });

    afterEach(() => closeDb());

    test('routes done to review and reports the stored status', async () => {
        const task = createTask({
            assignee: { agentId: 'agt_review', kind: 'agent' },
            id: 'tsk_review',
            title: 'Review this',
        });
        const tool = createTavernTaskTools({ agentId: 'agt_review' }).tasks_update as unknown as {
            execute: (input: unknown, options: ToolOptions) => Promise<ReviewResult>;
        };
        const result = await tool.execute(
            { status: 'done', summary: 'Completed and verified.', taskId: task.id },
            { context: undefined, messages: [], toolCallId: 'call_review' }
        );

        expect(result.task.status).toBe('review');
        expect(result.note).toContain('Review policy routed');
        expect(getTask(task.id)?.status).toBe('review');
    });

    test('does not rewrite direct task updates', () => {
        const task = createTask({ id: 'tsk_human_done', title: 'Direct close' });
        expect(updateTask(task.id, { status: 'done', summary: 'Closed directly.' })?.status).toBe(
            'done'
        );
    });
});

interface ReviewResult {
    note: string;
    task: { status: string };
}

interface ToolOptions {
    context: unknown;
    messages: [];
    toolCallId: string;
}
