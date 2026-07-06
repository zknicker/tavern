import { expect, test } from 'bun:test';
import { createAgentEventHandlers } from './use-agent-events.ts';

function createHandlers() {
    const invalidatedQueries: string[] = [];
    const handlers = createAgentEventHandlers({
        agent: {
            activity: {
                invalidate: async () => invalidatedQueries.push('agent.activity'),
            },
            get: {
                invalidate: async () => invalidatedQueries.push('agent.get'),
            },
            instructions: {
                invalidate: async () => invalidatedQueries.push('agent.instructions'),
            },
            list: {
                invalidate: async () => invalidatedQueries.push('agent.list'),
            },
            primary: {
                invalidate: async () => invalidatedQueries.push('agent.primary'),
            },
        },
        chat: {
            list: {
                invalidate: async () => invalidatedQueries.push('chat.list'),
            },
        },
    } as never);

    return { handlers, invalidatedQueries };
}

test('agent updates refresh agent caches and the Tavern chat sidebar list', async () => {
    const { handlers, invalidatedQueries } = createHandlers();

    handlers.onAgentUpdate();
    await Promise.resolve();

    expect(invalidatedQueries).toEqual([
        'agent.activity',
        'agent.get',
        'agent.list',
        'agent.primary',
        'chat.list',
    ]);
});

test('agent instruction updates target the changed agent', async () => {
    const { handlers, invalidatedQueries } = createHandlers();

    handlers.onAgentInstructionsUpdate({ agentId: 'agt_tiny' });
    await Promise.resolve();

    expect(invalidatedQueries).toEqual(['agent.instructions']);
});
