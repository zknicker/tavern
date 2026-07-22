import { expect, test } from 'bun:test';
import { emptyTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { resolveAgentActivityLabel } from './sidebar-agent-activity-strip.tsx';

test('agent activity labels follow live turn state', () => {
    const timeline = {
        ...emptyTimelineState(),
        activeReplies: [
            {
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-07-21T12:00:00.000Z',
                text: '',
            },
        ],
    };

    expect(
        resolveAgentActivityLabel({
            agentId: 'agent-1',
            agentName: 'Ada',
            fallbackLabel: 'Working…',
            timeline,
        })
    ).toBe('Ada is thinking...');

    timeline.activeReplies[0] = {
        ...timeline.activeReplies[0],
        isThinking: false,
        text: 'On it',
    };
    expect(
        resolveAgentActivityLabel({
            agentId: 'agent-1',
            agentName: 'Ada',
            fallbackLabel: 'Working…',
            timeline,
        })
    ).toBe('Ada is typing...');
});
