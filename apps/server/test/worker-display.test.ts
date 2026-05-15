import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkerDisplay } from '../src/workers/display.ts';

test('buildWorkerDisplay resolves agent/chat labels and raw session keys server-side', () => {
    const display = buildWorkerDisplay(
        {
            agentId: null,
            childSessionKey: null,
            description:
                '[Internal task completion event]\nsource: subagent\ntask: Investigate auth',
            error: null,
            kind: 'cli',
            progressSummary: null,
            requesterSessionKey: null,
            sessionKey: 'agent:main:discord:channel:1',
            terminalSummary: 'done',
            title: 'internal',
        },
        {
            agentLookup: {
                byAlias: new Map(),
                byDiscordId: new Map(),
                byId: new Map([
                    [
                        'main',
                        {
                            agentId: 'main',
                            displayName: 'Claw',
                        },
                    ],
                ]),
                byProviderAgentId: new Map(),
            },
            chatTitleBySessionKey: new Map([['agent:main:discord:channel:1', '#general']]),
        }
    );

    assert.equal(display.agentName, 'Claw');
    assert.equal(display.chatTitle, '#general');
    assert.equal(display.sessionKey, 'agent:main:discord:channel:1');
    assert.equal(display.detail, 'Investigate auth');
    assert.equal(display.title, '(Claw) Delivered a subagent result in #general.');
});
