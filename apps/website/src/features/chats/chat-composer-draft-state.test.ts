import { afterEach, expect, test } from 'bun:test';
import {
    clearChatComposerDraftsForTest,
    createChatComposerDraftState,
    hasDraftContent,
    normalizeChatComposerDraft,
    readChatComposerDraft,
    writeChatComposerDraft,
} from './chat-composer-draft-state.ts';

afterEach(() => {
    clearChatComposerDraftsForTest();
});

test('draft content includes non-whitespace text or attachments', () => {
    const emptyDraft = createChatComposerDraftState(['agent-1']);
    const attachment = {
        dataBase64: 'aGVsbG8=',
        filename: 'note.txt',
        mediaType: 'text/plain',
        sizeBytes: 5,
        type: 'inline' as const,
    };

    expect(hasDraftContent(emptyDraft)).toBe(false);
    expect(hasDraftContent({ ...emptyDraft, content: '   \n' })).toBe(false);
    expect(hasDraftContent({ ...emptyDraft, content: 'unfinished thought' })).toBe(true);
    expect(hasDraftContent({ ...emptyDraft, attachments: [attachment] })).toBe(true);
});

test('chat composer drafts are restored by chat id', () => {
    writeChatComposerDraft('chat-1', {
        ...createChatComposerDraftState(['agent-1']),
        content: 'do not drop this',
    });

    expect(readChatComposerDraft('chat-1', ['agent-1'])).toMatchObject({
        agentId: 'agent-1',
        content: 'do not drop this',
    });
    expect(readChatComposerDraft('chat-2', ['agent-1']).content).toBe('');
});

test('chat composer draft reads return defensive copies', () => {
    writeChatComposerDraft('chat-1', {
        ...createChatComposerDraftState(['agent-1']),
        attachments: [
            {
                dataBase64: 'aGVsbG8=',
                filename: 'note.txt',
                mediaType: 'text/plain',
                sizeBytes: 5,
                type: 'inline',
            },
        ],
        content: 'inspect this',
    });

    const firstRead = readChatComposerDraft('chat-1', ['agent-1']);
    firstRead.attachments.length = 0;
    firstRead.content = '';

    expect(readChatComposerDraft('chat-1', ['agent-1'])).toMatchObject({
        attachments: [{ filename: 'note.txt' }],
        content: 'inspect this',
    });
});

test('chat composer drafts normalize invalid bound agents', () => {
    expect(
        normalizeChatComposerDraft(
            {
                ...createChatComposerDraftState(['agent-1']),
                agentId: 'agent-removed',
                content: 'keep the text',
            },
            ['agent-2']
        )
    ).toMatchObject({
        agentId: 'agent-2',
        content: 'keep the text',
    });
});
