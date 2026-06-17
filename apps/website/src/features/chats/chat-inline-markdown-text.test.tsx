import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatInlineMarkdownText } from './chat-inline-markdown-text.tsx';
import {
    ChatTranscriptMessageContent,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';

test('ChatInlineMarkdownText wraps animated streaming text ranges', () => {
    const markup = renderToStaticMarkup(
        <ChatInlineMarkdownText
            animatedRanges={[{ end: 11, id: 'range-1', start: 6 }]}
            content="Hello world"
        />
    );

    expect(markup).toContain('Hello ');
    expect(markup).toContain('chat-streaming-text-chunk');
    expect(markup).toContain('chat-streaming-text-unit');
    expect(markup).toContain('world');
});

test('ChatInlineMarkdownText preserves inline markdown around animated ranges', () => {
    const markup = renderToStaticMarkup(
        <ChatInlineMarkdownText
            animatedRanges={[{ end: 7, id: 'range-1', start: 2 }]}
            content="**Hello** world"
        />
    );

    expect(markup).toContain('<strong');
    expect(markup).toContain('chat-streaming-text-unit');
    expect(markup).toContain('Hello');
});

test('ChatTranscriptMessageContent forwards animated ranges to transcript text', () => {
    const message = {
        attachments: [],
        content: 'Hello world',
        id: 'message-1',
        sender: 'Agent',
        senderType: 'agent',
        sourceSessionId: null,
        sourceSessionKey: 'session-1',
        timestamp: '2026-06-17T15:00:00.000Z',
    } satisfies TranscriptMessage;

    const markup = renderToStaticMarkup(
        <ChatTranscriptMessageContent
            animatedRanges={[{ end: 11, id: 'range-1', start: 6 }]}
            message={message}
        />
    );

    expect(markup).toContain('chat-streaming-text-chunk');
    expect(markup).toContain('chat-streaming-text-unit');
    expect(markup).toContain('world');
});
