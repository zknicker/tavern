import { mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const compositions = new Map([
    [
        'composition-thread',
        {
            agentId: 'agt_tiny',
            state: 'composing' as const,
            target: '#chan:anchor',
            text: 'Thread-only draft',
            updatedAt: Date.now(),
        },
    ],
]);

mock.module('../../hooks/chats/use-chat-compositions.ts', () => ({
    useChatCompositions: () => ({ compositions, dropComposition: () => undefined }),
}));
mock.module('../../hooks/agents/use-agent-list.ts', () => ({
    useAgentList: () => ({ data: { agents: [] } }),
}));
mock.module('../../hooks/chats/use-chat-list.ts', () => ({
    useChatList: () => ({
        data: {
            ids: ['cht_parent'],
            itemsById: {
                cht_parent: {
                    agentRuntimeSync: null,
                    boundAgentIds: [],
                    conversationKind: 'channel',
                    displayName: 'chan',
                    id: 'cht_parent',
                    isEnabled: true,
                    latestSession: null,
                    participants: [],
                    scope: 'channel',
                    sessionCount: 0,
                    source: { kind: 'tavern', label: 'Tavern' },
                    targetParticipant: null,
                    title: 'chan',
                    type: 'tavern',
                },
            },
        },
    }),
}));

const { ChatCompositionBubbles } = await import('./chat-composition-bubble.tsx');

test('thread compositions render only in the matching thread transcript', () => {
    const threadMarkup = renderToStaticMarkup(
        <ChatCompositionBubbles
            chatId="cht_thr_anchor"
            compositionTarget="#chan:anchor"
            messageCompositionIds={new Set()}
        />
    );
    const parentMarkup = renderToStaticMarkup(
        <ChatCompositionBubbles chatId="cht_parent" messageCompositionIds={new Set()} />
    );

    assert.match(threadMarkup, /Thread-only draft/);
    assert.doesNotMatch(parentMarkup, /Thread-only draft/);
});
