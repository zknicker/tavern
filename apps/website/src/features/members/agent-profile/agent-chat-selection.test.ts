import { describe, expect, test } from 'bun:test';
import { selectMostRecentAgentSessionChat } from './agent-chat-selection.ts';

type AgentChats = NonNullable<Parameters<typeof selectMostRecentAgentSessionChat>[0]>;
type AgentChat = AgentChats['itemsById'][string];

function chat(overrides: Partial<AgentChat>): AgentChat {
    return {
        activeTurnParticipantIds: [],
        agentRuntimeSync: null,
        archived: false,
        boundAgentIds: ['agent-1'],
        canSend: true,
        conversationKind: 'direct',
        createdAt: '2026-07-01T00:00:00.000Z',
        description: null,
        displayName: 'Agent chat',
        framework: 'tavern',
        id: 'chat-1',
        isEnabled: true,
        lastActivityAt: '2026-07-01T00:00:00.000Z',
        latestSession: null,
        participants: [],
        scope: 'dm',
        sessionCount: 1,
        source: { kind: 'tavern', label: 'Tavern' },
        systemPrompt: null,
        tabAppearance: { color: null },
        targetParticipant: null,
        title: 'Agent chat',
        type: 'tavern',
        unreadCount: 0,
        ...overrides,
    };
}

function chatList(...chats: AgentChat[]): AgentChats {
    return {
        ids: chats.map((entry) => entry.id),
        itemsById: Object.fromEntries(chats.map((entry) => [entry.id, entry])),
    };
}

describe('agent session chat selection', () => {
    test('uses an external runtime chat when the agent has no Tavern chat', () => {
        const external = chat({
            framework: 'agentRuntime',
            id: 'discord-chat',
            source: { kind: 'discord', label: 'Discord' },
            type: 'discord',
        });

        expect(selectMostRecentAgentSessionChat(chatList(external))?.id).toBe('discord-chat');
    });

    test('uses an archived Tavern chat as a session address', () => {
        const archived = chat({ archived: true, id: 'archived-chat' });

        expect(selectMostRecentAgentSessionChat(chatList(archived))?.id).toBe('archived-chat');
    });
});
