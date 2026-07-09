import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { AgentRuntimeChat, AgentRuntimeTask } from '@tavern/api';

const [
    invalidationEvents,
    chatSave,
    runtimeChats,
    chatSend,
    agentStorage,
    taskStorage,
    taskMutations,
    { dispatchTask },
] = await Promise.all([
    import('../api/invalidation-events.ts'),
    import('../chat/save.ts'),
    import('../chat/runtime-chats.ts'),
    import('../chat/send.ts'),
    import('../storage/agents.ts'),
    import('../storage/tasks.ts'),
    import('./mutations.ts'),
    import('./dispatch.ts'),
]);

afterEach(() => {
    mock.restore();
});

test('dispatch creates one task chat and reuses it on later attempts', async () => {
    const task = buildTask({ workChatId: null });
    const client = buildRuntimeClient(task);
    spyOn(agentStorage, 'getAgent').mockResolvedValue({ id: 'agt_primary' } as never);
    spyOn(taskMutations, 'requireActiveTaskRuntime').mockResolvedValue({
        client: client as never,
        runtimeId: 'runtime-1',
    });
    const createChat = spyOn(chatSave, 'createTavernChat').mockResolvedValue({
        chatId: 'cht_task',
    });
    const updateChat = spyOn(runtimeChats, 'updateRuntimeTavernChat').mockResolvedValue(undefined);
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockImplementation(async (chatId) =>
        chatId === 'cht_task'
            ? {
                  chat: buildChat({ agentIds: ['agt_primary'], chatId: 'cht_task' }),
                  createdAt: '2026-07-09T12:00:00.000Z',
                  lastActivityAt: null,
                  runtimeId: 'runtime-1',
                  updatedAt: '2026-07-09T12:00:00.000Z',
              }
            : null
    );
    const sendMessage = spyOn(chatSend, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-07-09T12:00:00.000Z',
        chatId: 'cht_task',
        clientMessageId: 'msg_1',
        status: 'accepted',
        turns: [{ agentId: 'agt_primary', runId: 'run_1' }],
    });
    spyOn(taskStorage, 'saveTaskRecord').mockResolvedValue('tsk_1');
    spyOn(invalidationEvents, 'emitTasksUpdated').mockImplementation(() => undefined);

    await dispatchTask({ agentId: 'agt_primary', taskId: 'tsk_1' });
    await dispatchTask({ agentId: 'agt_primary', taskId: 'tsk_1' });

    assert.equal(createChat.mock.calls.length, 1);
    assert.deepEqual(createChat.mock.calls[0], [
        {
            agentIds: ['agt_primary'],
            displayName: 'T-12: Fix dispatch',
            kind: 'task',
        },
    ]);
    assert.equal(client.setTaskWorkChatCalls.length, 1);
    assert.deepEqual(client.setTaskWorkChatCalls[0], ['tsk_1', { workChatId: 'cht_task' }]);
    assert.equal(updateChat.mock.calls.length, 1);
    assert.deepEqual(
        sendMessage.mock.calls.map((call) => call[0]?.chatId),
        ['cht_task', 'cht_task']
    );
    assert.deepEqual(
        sendMessage.mock.calls.map((call) => call[0]?.agentId),
        ['agt_primary', 'agt_primary']
    );
});

test('dispatch reassignment adds the new agent to the existing task chat', async () => {
    const task = buildTask({
        assignee: { agentId: 'agt_old', kind: 'agent' },
        workChatId: 'cht_task',
    });
    const client = buildRuntimeClient(task);
    spyOn(agentStorage, 'getAgent').mockResolvedValue({ id: 'agt_new' } as never);
    spyOn(taskMutations, 'requireActiveTaskRuntime').mockResolvedValue({
        client: client as never,
        runtimeId: 'runtime-1',
    });
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: buildChat({ agentIds: ['agt_old'], chatId: 'cht_task' }),
        createdAt: '2026-07-09T12:00:00.000Z',
        lastActivityAt: null,
        runtimeId: 'runtime-1',
        updatedAt: '2026-07-09T12:00:00.000Z',
    });
    const updateChat = spyOn(runtimeChats, 'updateRuntimeTavernChat').mockResolvedValue(undefined);
    const createChat = spyOn(chatSave, 'createTavernChat').mockResolvedValue({
        chatId: 'cht_new',
    });
    spyOn(chatSend, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-07-09T12:00:00.000Z',
        chatId: 'cht_task',
        clientMessageId: 'msg_1',
        status: 'accepted',
        turns: [{ agentId: 'agt_new', runId: 'run_1' }],
    });
    spyOn(taskStorage, 'saveTaskRecord').mockResolvedValue('tsk_1');
    spyOn(invalidationEvents, 'emitTasksUpdated').mockImplementation(() => undefined);

    await dispatchTask({ agentId: 'agt_new', taskId: 'tsk_1' });

    assert.equal(createChat.mock.calls.length, 0);
    assert.deepEqual(updateChat.mock.calls[0], [
        {
            agentIds: ['agt_old', 'agt_new'],
            archived: false,
            displayName: 'T-12: Fix dispatch',
            id: 'cht_task',
            kind: 'task',
        },
    ]);
    assert.equal(client.setTaskWorkChatCalls.length, 0);
});

function buildRuntimeClient(task: AgentRuntimeTask) {
    let current = task;
    return {
        setTaskWorkChatCalls: [] as unknown[][],
        async getTask() {
            return current;
        },
        async setTaskWorkChat(taskId: string, input: { workChatId: string }) {
            this.setTaskWorkChatCalls.push([taskId, input]);
            current = { ...current, workChatId: input.workChatId };
            return current;
        },
        async updateTask(_taskId: string, patch: Partial<AgentRuntimeTask>) {
            current = { ...current, ...patch };
            return current;
        },
    };
}

function buildTask(overrides: Partial<AgentRuntimeTask> = {}): AgentRuntimeTask {
    return {
        assignee: null,
        blockedBy: [],
        blockedReason: null,
        createdAt: '2026-07-09T12:00:00.000Z',
        description: 'Implement the dispatch change.',
        epicId: null,
        id: 'tsk_1',
        kind: 'task',
        labels: [],
        number: 12,
        priority: 'high',
        scheduledFor: null,
        status: 'todo',
        summary: null,
        title: 'Fix dispatch',
        updatedAt: '2026-07-09T12:00:00.000Z',
        workChatId: null,
        ...overrides,
    };
}

function buildChat(input: { agentIds: string[]; chatId: string }): AgentRuntimeChat {
    return {
        activeTurnParticipantIds: [],
        bindingId: null,
        bindings: input.agentIds.map((agentId) => ({ agentId })),
        id: input.chatId,
        inboundMode: 'active',
        metadata: { tavern: { archived: false, displayName: 'T-12: Fix dispatch' } },
        parentTarget: null,
        participants: [
            {
                accountKey: null,
                externalId: null,
                name: 'You',
                observedLabels: ['You'],
                participantId: 'usr_tavern',
                platform: 'tavern',
                type: 'participant',
            },
            ...input.agentIds.map((agentId) => ({ agentId, type: 'agent' as const })),
        ],
        platform: 'tavern',
        platformMetadata: {
            chatId: input.chatId,
            conversationId: null,
            observedLabels: ['T-12: Fix dispatch'],
            provider: 'tavern',
            sourceRecords: [],
        },
        requiresTrigger: false,
        scope: 'task',
        target: `task:${input.chatId}`,
        trigger: null,
    };
}
