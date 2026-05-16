import assert from 'node:assert/strict';
import test from 'node:test';
import { getChatTimelineFollowKey } from './chat-timeline-follow-key.ts';

const activeReply = {
    agentId: 'agent-1',
    isThinking: true,
    runId: 'run-1',
    sessionKey: 'session-1',
    startedAt: '2026-05-15T19:52:00.000Z',
    text: '',
};

test('getChatTimelineFollowKey tracks thinking, working, and reply phases', () => {
    assert.equal(
        getChatTimelineFollowKey({
            activeReply,
            activeReplySteps: [],
        }),
        'run-1:thinking'
    );

    assert.equal(
        getChatTimelineFollowKey({
            activeReply,
            activeReplySteps: [
                {
                    id: 'tool:pwd',
                    kind: 'tool',
                    label: 'Running pwd',
                    status: 'active',
                },
            ],
        }),
        'run-1:working'
    );

    assert.equal(
        getChatTimelineFollowKey({
            activeReply: {
                ...activeReply,
                isThinking: false,
                text: 'Done.',
            },
            activeReplySteps: [],
        }),
        'run-1:reply'
    );
});
