import assert from 'node:assert/strict';
import test from 'node:test';
import { getChatMessageLayout } from './chat-message-layout.ts';

const baseChat = {
    boundAgentIds: ['agent-1'],
    participants: [
        {
            actorId: 'agent-1',
            actorType: 'agent' as const,
        },
        {
            actorId: 'human-1',
            actorType: 'participant' as const,
        },
    ],
};

test('uses channel identities for a direct human and agent chat', () => {
    assert.deepEqual(getChatMessageLayout(baseChat), {
        showAgentIdentity: true,
        showHumanIdentity: true,
    });
});

test('keeps channel identities when a chat has multiple agents', () => {
    assert.deepEqual(
        getChatMessageLayout({
            ...baseChat,
            boundAgentIds: ['agent-1', 'agent-2'],
        }),
        {
            showAgentIdentity: true,
            showHumanIdentity: true,
        }
    );
});

test('keeps channel identities when a chat has multiple humans', () => {
    assert.deepEqual(
        getChatMessageLayout({
            ...baseChat,
            participants: [
                ...baseChat.participants,
                {
                    actorId: 'human-2',
                    actorType: 'participant' as const,
                },
            ],
        }),
        {
            showAgentIdentity: true,
            showHumanIdentity: true,
        }
    );
});
