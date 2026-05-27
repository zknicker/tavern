import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { listAgentActivity } from '../src/agents/activity.ts';
import * as agentCatalog from '../src/agents/catalog.ts';
import * as runtimeSessions from '../src/sessions/runtime-sessions.ts';

afterEach(() => {
    mock.restore();
});

function createAgent(
    overrides: Partial<Awaited<ReturnType<typeof agentCatalog.listAgents>>[number]> = {}
) {
    return {
        avatar: null,
        enabledSkillIds: null,
        emoji: null,
        id: 'agent-1',
        name: 'Alpha Agent',
        primaryColor: null,
        runtimeId: 'runtime-1',
        updatedAt: '2026-03-13T00:00:00.000Z',
        ...overrides,
    };
}

test('listAgentActivity keeps activity separate from agent records and uses synced sessions', async () => {
    spyOn(agentCatalog, 'listAgents').mockImplementation(async () => [
        createAgent(),
        createAgent({
            id: 'agent-2',
            name: 'Beta Agent',
        }),
    ]);
    spyOn(runtimeSessions, 'listRuntimeSessions').mockImplementation(async () => [
        createSession({
            agentId: 'agent-1',
            key: 'agent:agent-1:session-1',
            lastActivityAt: '2026-03-13T00:02:00.000Z',
            startedAt: '2026-03-13T00:02:00.000Z',
        }),
        createSession({
            agentId: 'agent-2',
            key: 'agent:agent-2:session-2',
            lastActivityAt: '2026-03-13T00:01:00.000Z',
            startedAt: '2026-03-13T00:01:00.000Z',
        }),
    ]);

    const activity = await listAgentActivity();

    assert.deepEqual(activity, [
        {
            agentId: 'agent-1',
            state: 'idle',
            updatedAt: '2026-03-13T00:02:00.000Z',
        },
        {
            agentId: 'agent-2',
            state: 'idle',
            updatedAt: '2026-03-13T00:01:00.000Z',
        },
    ]);
});

function createSession(input: {
    agentId: string;
    key: string;
    lastActivityAt: string;
    startedAt: string;
}) {
    return {
        agentId: input.agentId,
        chatId: 'tavern:ops',
        key: input.key,
        lastActivityAt: input.lastActivityAt,
        messageCount: 1,
        parentSessionKey: null,
        platform: 'tavern',
        sessionId: input.key,
        sessionRole: 'main',
        startedAt: input.startedAt,
        title: 'Ops Session',
    };
}
