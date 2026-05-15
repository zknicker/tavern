import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveConversationKindFromConfiguredScope,
    resolveObservedConversationKind,
} from './conversation-kind.ts';

test('configured target scopes map to canonical conversation kinds', () => {
    assert.equal(resolveConversationKindFromConfiguredScope('guild-channel'), 'channel');
    assert.equal(resolveConversationKindFromConfiguredScope('dm'), 'direct');
    assert.equal(resolveConversationKindFromConfiguredScope('group'), 'group');
});

test('observed discord channel-shaped direct chats materialize as direct conversations', () => {
    const conversationKind = resolveObservedConversationKind({
        configured: false,
        participants: [
            {
                actorType: 'participant',
            },
            {
                actorType: 'agent',
            },
        ],
        target: 'channel:1480396502747578378',
        type: 'discord',
    });

    assert.equal(conversationKind, 'direct');
});
