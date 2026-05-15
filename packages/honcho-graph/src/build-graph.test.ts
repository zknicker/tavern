import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphSnapshot } from './build-graph.ts';

test('buildGraphSnapshot creates aggregated pair, peer, and session graph records', () => {
    const graph = buildGraphSnapshot({
        peerRows: [
            {
                activeSessionCount: 1,
                conclusionCount: 3,
                createdAt: '2026-03-13T12:00:00.000Z',
                lastConclusionAt: '2026-03-13T12:05:00.000Z',
                lastMessageAt: '2026-03-13T12:04:00.000Z',
                messageCount: 7,
                name: 'agent/main',
                representationInCount: 0,
                representationOutCount: 1,
                sessionCount: 1,
                workspaceName: 'tavern',
            },
            {
                activeSessionCount: 1,
                conclusionCount: 3,
                createdAt: '2026-03-13T12:00:00.000Z',
                lastConclusionAt: '2026-03-13T12:05:00.000Z',
                lastMessageAt: '2026-03-13T12:04:00.000Z',
                messageCount: 7,
                name: 'user:alice',
                representationInCount: 1,
                representationOutCount: 0,
                sessionCount: 1,
                workspaceName: 'tavern',
            },
        ],
        memoryRows: [
            {
                content: 'Alice prefers async updates over meetings.',
                createdAt: '2026-03-13T12:02:00.000Z',
                id: 'doc-1',
                level: 'explicit',
                observed: 'user:alice',
                observer: 'agent/main',
                sessionName: 'chat/primary',
                sourceIds: null,
                timesDerived: 1,
                workspaceName: 'tavern',
            },
            {
                content: 'Alice is likely time-constrained this week.',
                createdAt: '2026-03-13T12:03:00.000Z',
                id: 'doc-2',
                level: 'inductive',
                observed: 'user:alice',
                observer: 'agent/main',
                sessionName: 'chat/primary',
                sourceIds: ['doc-1'],
                timesDerived: 2,
                workspaceName: 'tavern',
            },
        ],
        representationRows: [
            {
                collectionCreatedAt: '2026-03-13T12:01:00.000Z',
                conclusionCount: 3,
                contradictionCount: 0,
                deductiveCount: 1,
                explicitCount: 1,
                inductiveCount: 1,
                lastConclusionAt: '2026-03-13T12:05:00.000Z',
                observed: 'user:alice',
                observer: 'agent/main',
                sessionCount: 1,
                workspaceName: 'tavern',
            },
        ],
        sessionPeerRows: [
            {
                configuration: {
                    observe_me: false,
                    observe_others: true,
                },
                joinedAt: '2026-03-13T12:00:00.000Z',
                lastMessageAt: '2026-03-13T12:04:00.000Z',
                leftAt: null,
                messageCount: 7,
                peerName: 'user:alice',
                sessionName: 'chat/primary',
                workspaceName: 'tavern',
            },
        ],
        sessionRows: [
            {
                activeParticipantCount: 1,
                createdAt: '2026-03-13T12:00:00.000Z',
                isActive: true,
                lastMessageAt: '2026-03-13T12:04:00.000Z',
                messageCount: 9,
                name: 'chat/primary',
                participantCount: 2,
                workspaceName: 'tavern',
            },
        ],
        workspaceName: 'tavern',
    });

    assert.equal(graph.nodes.length, 4);
    assert.equal(graph.edges.length, 4);
    assert.equal(graph.stats.totalMemories, 2);
    assert.equal(graph.stats.totalPairs, 1);

    const pairNode = graph.nodes.find((node) => node.kind === 'pair');
    assert.ok(pairNode);
    assert.equal(pairNode.id, 'pair:tavern:agent%2Fmain:user%3Aalice');
    assert.equal(pairNode.metrics.memoryCount, 2);
    assert.equal(pairNode.metrics.levelCounts.explicit, 1);
    assert.equal(pairNode.metrics.levelCounts.inductive, 1);

    const peerNode = graph.nodes.find(
        (node): node is Extract<(typeof graph.nodes)[number], { kind: 'peer' }> =>
            node.kind === 'peer' && node.label === 'user:alice'
    );
    assert.ok(peerNode);
    assert.equal(peerNode.metrics.observedByCount, 1);

    const sessionNode = graph.nodes.find((node) => node.kind === 'session');
    assert.ok(sessionNode);
    assert.equal(sessionNode.metrics.memoryCount, 2);
    assert.equal(sessionNode.metrics.pairCount, 1);

    const observesEdge = graph.edges.find((edge) => edge.kind === 'observes');
    assert.ok(observesEdge);
    assert.equal(observesEdge.metrics.memoryCount, 2);

    const aboutEdge = graph.edges.find((edge) => edge.kind === 'about');
    assert.ok(aboutEdge);
    assert.equal(aboutEdge.targetId, 'peer:tavern:user%3Aalice');

    const appearsInEdge = graph.edges.find((edge) => edge.kind === 'appears_in');
    assert.ok(appearsInEdge);
    assert.equal(appearsInEdge.targetId, 'session:tavern:chat%2Fprimary');

    const participationEdge = graph.edges.find((edge) => edge.kind === 'participates_in');
    assert.ok(participationEdge);
    assert.equal(participationEdge.metrics.observeOthers, true);
    assert.equal(participationEdge.metrics.observeMe, false);
});
