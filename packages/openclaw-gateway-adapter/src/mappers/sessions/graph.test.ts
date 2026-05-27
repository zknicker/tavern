import { describe, expect, it } from 'bun:test';
import { mapOpenClawSessionGraph } from './graph.ts';

describe('mapOpenClawSessionGraph', () => {
    it('uses the session key as the graph session id when OpenClaw omits sessionId', () => {
        const graph = mapOpenClawSessionGraph({
            messages: [],
            session: {
                agentId: 'main',
                key: 'agent:main:tavern:channel:cht_1',
                title: 'Chat 1',
            },
            sessionKey: 'agent:main:tavern:channel:cht_1',
        });

        expect(graph.sessions[0]).toMatchObject({
            key: 'agent:main:tavern:channel:cht_1',
            sessionId: 'agent:main:tavern:channel:cht_1',
        });
    });
});
