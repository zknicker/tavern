import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeChats from '../src/chat/runtime-chats.ts';
import { startTavernChatAgentSession } from '../src/chat/start-agent-session.ts';

afterEach(() => {
    mock.restore();
});

test('startTavernChatAgentSession rotates the only agent seat through Runtime', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            bindingId: null,
            bindings: [],
            id: 'cht_general',
            inboundMode: 'active',
            metadata: {},
            parentTarget: null,
            participants: [{ agentId: 'agt_primary', type: 'agent' }],
            platform: 'tavern',
            platformMetadata: {
                chatId: 'cht_general',
                conversationId: null,
                observedLabels: ['#general'],
                provider: 'tavern',
                sourceRecords: [],
            },
            requiresTrigger: false,
            scope: 'channel',
            target: 'chat:cht_general',
            trigger: null,
        },
        createdAt: '2026-06-29T12:00:00.000Z',
        isPinned: false,
        runtimeId: 'runtime-local',
        updatedAt: '2026-06-29T12:00:00.000Z',
    });
    const calls: unknown[] = [];
    const client = {
        startAgentSession: async (chatId: string, input: unknown) => {
            calls.push({ chatId, input });
            return {
                session: {
                    agentId: 'agt_primary',
                    agentParticipantId: 'agt_primary',
                    archivedAt: null,
                    chatId,
                    createdAt: '2026-06-29T12:00:01.000Z',
                    effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
                    generation: 2,
                    id: 'ags_cht_general_agt_primary_2',
                    resumeState: null,
                    runtimeSessionId: null,
                    status: 'active' as const,
                    updatedAt: '2026-06-29T12:00:01.000Z',
                },
            };
        },
    };

    const result = await startTavernChatAgentSession({ chatId: 'cht_general' }, client as never);

    assert.deepEqual(calls, [
        {
            chatId: 'cht_general',
            input: { agentParticipantId: 'agt_primary' },
        },
    ]);
    assert.equal(result.session.id, 'ags_cht_general_agt_primary_2');
});

test('startTavernChatAgentSession rejects ambiguous agent seats', async () => {
    spyOn(runtimeChats, 'getRuntimeChatRecord').mockResolvedValue({
        chat: {
            bindingId: null,
            bindings: [],
            id: 'cht_general',
            inboundMode: 'active',
            metadata: {},
            parentTarget: null,
            participants: [
                { agentId: 'agt_primary', type: 'agent' },
                { agentId: 'agt_second', type: 'agent' },
            ],
            platform: 'tavern',
            platformMetadata: {
                chatId: 'cht_general',
                conversationId: null,
                observedLabels: ['#general'],
                provider: 'tavern',
                sourceRecords: [],
            },
            requiresTrigger: false,
            scope: 'channel',
            target: 'chat:cht_general',
            trigger: null,
        },
        createdAt: '2026-06-29T12:00:00.000Z',
        isPinned: false,
        runtimeId: 'runtime-local',
        updatedAt: '2026-06-29T12:00:00.000Z',
    });

    await assert.rejects(
        async () => await startTavernChatAgentSession({ chatId: 'cht_general' }, {} as never),
        /multiple agent seats/
    );
});
