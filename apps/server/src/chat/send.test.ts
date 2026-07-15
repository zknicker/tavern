import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { resolveTargetAgentIds } from './send.ts';

type ResolveChat = Parameters<typeof resolveTargetAgentIds>[0]['chat'];

function channelChat(agentIds: string[]): ResolveChat {
    return {
        bindings: agentIds.map((agentId) => ({ agentId })),
        id: 'cht_general',
        metadata: {},
        scope: 'channel',
    } as unknown as ResolveChat;
}

test('every channel agent seat gets a turn, mentioned or not', () => {
    const targets = resolveTargetAgentIds({
        chat: channelChat(['agt_otto', 'agt_wren']),
        content: 'morning everyone',
    });

    assert.deepEqual(new Set(targets), new Set(['agt_otto', 'agt_wren']));
});

test('mentions never narrow channel dispatch', () => {
    const targets = resolveTargetAgentIds({
        chat: channelChat(['agt_otto', 'agt_wren', 'agt_kit']),
        content: 'hey [Wren](agent://agt_wren), and everyone else too',
    });

    assert.deepEqual(new Set(targets), new Set(['agt_otto', 'agt_wren', 'agt_kit']));
});

test('mentioning a non-member still fails loudly', () => {
    assert.throws(
        () =>
            resolveTargetAgentIds({
                chat: channelChat(['agt_otto']),
                content: 'ping [Ghost](agent://agt_ghost)',
            }),
        /not part of chat/
    );
});
