import { expect, test } from 'bun:test';
import { getChatDraftRouteState } from './use-chat-draft-launch.ts';

test('getChatDraftRouteState accepts a draft chat route state', () => {
    expect(getChatDraftRouteState({ draftChatId: 'tavern-draft-chat:1' })).toEqual({
        draftChatId: 'tavern-draft-chat:1',
    });
});

test('getChatDraftRouteState rejects missing draft ids', () => {
    expect(getChatDraftRouteState(null)).toBeNull();
    expect(getChatDraftRouteState({})).toBeNull();
    expect(getChatDraftRouteState({ draftChatId: '' })).toBeNull();
    expect(getChatDraftRouteState({ draftChatId: 1 })).toBeNull();
});
