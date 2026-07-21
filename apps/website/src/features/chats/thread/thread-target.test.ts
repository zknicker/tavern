import { expect, test } from 'bun:test';
import { threadPaneTitles } from './thread-target.ts';

const baseChat = {
    displayName: 'general',
    participants: [],
    scope: 'channel' as const,
    targetParticipant: null,
    title: '#general',
    type: 'tavern',
};

test('threadPaneTitles names a channel and trims the message prefix for its short id', () => {
    expect(
        threadPaneTitles({ ...baseChat, conversationKind: 'channel' }, 'msg_12345678abcdef')
    ).toEqual({
        header: 'Thread — #general',
        target: '#general:12345678',
    });
});

test('threadPaneTitles names a DM for its non-operator peer', () => {
    expect(
        threadPaneTitles(
            {
                ...baseChat,
                conversationKind: 'direct',
                participants: [
                    { actorId: 'usr_tavern', actorType: 'participant', name: 'You' },
                    { actorId: 'agent-tiny', actorType: 'agent', name: 'Tiny' },
                ],
                scope: 'dm',
            },
            'msg_abcdefgh987654'
        )
    ).toEqual({
        header: 'Thread — @Tiny',
        target: 'dm:@Tiny:abcdefgh',
    });
});
