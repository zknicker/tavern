import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import type { AgentApiError } from './agent-api-errors.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { listAgentTasks, updateAgentTask } from './agent-tasks.ts';
import { upsertStoredAgent } from './agents-store.ts';
import {
    createChat,
    createMessage,
    promoteMessageToTask,
    type TaskRuleError,
    unclaimTask,
    updateTaskStatus,
} from './chat-api/index.ts';

describe('agent task rules', () => {
    let root: string;

    beforeEach(() => {
        root = initAgentApiTestDb('tavern-agent-tasks-');
        seedAgent('agt_one', 'One');
        seedAgent('agt_two', 'Two');
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [
                { id: 'agt_one', kind: 'agent', label: 'One', metadata: { agentId: 'agt_one' } },
                { id: 'agt_two', kind: 'agent', label: 'Two', metadata: { agentId: 'agt_two' } },
            ],
            title: 'general',
        });
    });

    afterEach(async () => await closeAgentApiTestDb(root));

    it('lets only the claimant update a claimed task and leaves unassigned tasks open', () => {
        seedTask('msg_10000000000000000000000000000001', 'agt_one');

        expect(() =>
            updateAgentTask('agt_two', {
                number: 1,
                status: 'in_review',
                target: '#general',
            })
        ).toThrow(
            expect.objectContaining<Partial<AgentApiError>>({ code: 'TASK_CLAIMED_BY_OTHER' })
        );
        expect(
            updateAgentTask('agt_one', {
                number: 1,
                status: 'in_review',
                target: '#general',
            }).task.status
        ).toBe('in_review');

        seedTask('msg_20000000000000000000000000000002', null);
        expect(
            updateAgentTask('agt_two', {
                number: 2,
                status: 'in_progress',
                target: '#general',
            }).task.status
        ).toBe('in_progress');
    });

    it('lists tasks only while the caller remains a current chat member', () => {
        seedTask('msg_30000000000000000000000000000003', null, 'agt_one');
        expect(listAgentTasks('agt_one', {}).tasks).toHaveLength(1);

        getDb()
            .prepare(
                `DELETE FROM chat_participants
                 WHERE chat_id = 'cht_general' AND id = 'agt_one'`
            )
            .run();

        expect(listAgentTasks('agt_one', {}).tasks).toEqual([]);
    });

    it('rejects unclaiming done tasks and allows in-review tasks', () => {
        seedTask('msg_40000000000000000000000000000004', 'agt_one');
        updateTaskStatus({ chatId: 'cht_general', number: 1, status: 'done' });
        expect(() => unclaimTask({ actorId: 'agt_one', chatId: 'cht_general', number: 1 })).toThrow(
            expect.objectContaining<Partial<TaskRuleError>>({ code: 'TASK_DONE' })
        );

        seedTask('msg_50000000000000000000000000000005', 'agt_one');
        updateTaskStatus({ chatId: 'cht_general', number: 2, status: 'in_review' });
        expect(
            unclaimTask({ actorId: 'agt_one', chatId: 'cht_general', number: 2 }).assignee
        ).toBeNull();
    });

    function seedTask(messageId: string, assigneeId: string | null, authorId = 'usr_tavern') {
        createMessage('cht_general', {
            author_id: authorId,
            content: messageId,
            id: messageId,
            role: authorId.startsWith('agt_') ? 'assistant' : 'user',
        });
        return promoteMessageToTask({
            actorId: assigneeId ?? authorId,
            assigneeId,
            messageId,
            origin: 'composed',
        });
    }

    function seedAgent(id: string, name: string) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id,
                isAdmin: false,
                name,
                primaryColor: null,
                workspaceFolder: root,
            },
        });
    }
});
