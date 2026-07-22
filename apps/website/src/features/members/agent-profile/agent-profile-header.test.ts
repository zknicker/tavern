import { expect, test } from 'bun:test';
import { selectAgentRunId } from './agent-profile-header.tsx';

test('the profile Stop action selects a hydrated active run for its agent', () => {
    expect(
        selectAgentRunId(
            {
                activeReplies: [],
                activeTurns: [
                    { agentId: 'agent-1', runId: 'run-1' },
                    { agentId: 'agent-2', runId: 'run-2' },
                ],
            },
            'agent-1'
        )
    ).toBe('run-1');
});
