import { describe, expect, test } from 'bun:test';
import { type ChatStartDraft, removeReconciledDraftsForChat } from './use-chat-start-drafts.tsx';

function createDraft(overrides: Partial<ChatStartDraft> = {}): ChatStartDraft {
    return {
        agentId: 'agent-1',
        clientMessageId: 'msg_1',
        content: 'Hello',
        createdAt: '2026-05-13T12:00:00.000Z',
        errorMessage: null,
        id: 'tavern-draft-chat:1',
        realAcceptedAt: null,
        realChatId: null,
        realRunId: null,
        realSessionKey: null,
        status: 'queued',
        title: 'Hello',
        ...overrides,
    };
}

describe('removeReconciledDraftsForChat', () => {
    test('removes drafts that reconciled to an archived chat', () => {
        const pendingDraft = createDraft({ id: 'tavern-draft-chat:pending' });
        const archivedDraft = createDraft({
            id: 'tavern-draft-chat:archived',
            realChatId: 'chat-1',
            status: 'reconciled',
        });
        const otherDraft = createDraft({
            id: 'tavern-draft-chat:other',
            realChatId: 'chat-2',
            status: 'reconciled',
        });
        const drafts = {
            [pendingDraft.id]: pendingDraft,
            [archivedDraft.id]: archivedDraft,
            [otherDraft.id]: otherDraft,
        };

        const result = removeReconciledDraftsForChat(drafts, 'chat-1');

        expect(result.removedDrafts).toEqual([archivedDraft]);
        expect(result.drafts).toEqual({
            [pendingDraft.id]: pendingDraft,
            [otherDraft.id]: otherDraft,
        });
    });

    test('keeps the current draft record when no reconciled draft matches', () => {
        const drafts = {
            'tavern-draft-chat:1': createDraft(),
        };

        const result = removeReconciledDraftsForChat(drafts, 'chat-1');

        expect(result.removedDrafts).toEqual([]);
        expect(result.drafts).toBe(drafts);
    });
});
