import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import {
    ChatTranscriptMessageContent,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';

test('ChatMarkdownText wraps animated streaming text ranges', () => {
    const markup = renderToStaticMarkup(
        <ChatMarkdownText
            animatedRanges={[{ end: 11, id: 'range-1', start: 6 }]}
            content="Hello world"
        />
    );

    expect(markup).toContain('Hello ');
    expect(markup).toContain('chat-streaming-text-chunk');
    expect(markup).toContain('chat-streaming-text-unit');
    expect(markup).toContain('world');
});

test('ChatMarkdownText preserves inline markdown around animated ranges', () => {
    const markup = renderToStaticMarkup(
        <ChatMarkdownText
            animatedRanges={[{ end: 7, id: 'range-1', start: 2 }]}
            content="**Hello** world"
        />
    );

    expect(markup).toContain('<strong');
    expect(markup).toContain('chat-streaming-text-unit');
    expect(markup).toContain('Hello');
});

test('ChatMarkdownText renders compact heading blocks', () => {
    const markup = renderToStaticMarkup(
        <ChatMarkdownText content={'# Test\n\n## Test 2\n\n### Test 3'} />
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('Test</h1>');
    expect(markup).toContain('<h2');
    expect(markup).toContain('Test 2</h2>');
    expect(markup).toContain('<h3');
    expect(markup).toContain('Test 3</h3>');
    expect(markup).not.toContain('# Test');
});

test('ChatMarkdownText keeps heading markers literal inside fenced text', () => {
    const markup = renderToStaticMarkup(<ChatMarkdownText content={'```\n# Test\n```'} />);

    expect(markup).not.toContain('<h1');
    expect(markup).toContain('# Test');
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
