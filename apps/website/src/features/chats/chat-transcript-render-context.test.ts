import { expect, test } from 'bun:test';
import { resolveTranscriptInteractionHosts } from './chat-transcript-render-context.tsx';

test('the parent chat owns normal transcript interactions', () => {
    expect(resolveTranscriptInteractionHosts({ chatId: 'chat-1' })).toEqual({
        composerId: 'chat-1',
        profilePaneChatId: 'chat-1',
    });
});

test('thread transcripts target their thread composer and parent profile pane', () => {
    expect(
        resolveTranscriptInteractionHosts({
            chatId: 'thread-1',
            composerId: 'chat-1:thread:message-1',
            profilePaneChatId: 'chat-1',
        })
    ).toEqual({
        composerId: 'chat-1:thread:message-1',
        profilePaneChatId: 'chat-1',
    });
});
