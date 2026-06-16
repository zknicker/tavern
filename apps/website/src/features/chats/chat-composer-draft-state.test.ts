import { afterEach, expect, test } from 'bun:test';
import {
    clearChatComposerDraftsForTest,
    createChatComposerDraftState,
    normalizeChatComposerDraft,
    readChatComposerDraft,
    writeChatComposerDraft,
} from './chat-composer-draft-state.ts';

afterEach(() => {
    clearChatComposerDraftsForTest();
});

test('chat composer drafts are restored by chat id', () => {
    writeChatComposerDraft('chat-1', {
        ...createChatComposerDraftState(['agent-1']),
        content: 'do not drop this',
        modelRef: 'openai/gpt-5',
    });

    expect(readChatComposerDraft('chat-1', ['agent-1'])).toMatchObject({
        agentId: 'agent-1',
        content: 'do not drop this',
        modelRef: 'openai/gpt-5',
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
