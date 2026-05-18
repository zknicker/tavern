import { describe, expect, test } from 'bun:test';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { buildDraftActiveReply } from './chat-draft-detail.tsx';

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

describe('buildDraftActiveReply', () => {
    test('shows immediate local thinking state for active chat drafts', () => {
        expect(buildDraftActiveReply(createDraft())).toEqual({
            agentId: 'agent-1',
            isThinking: true,
            runId: 'msg_1',
            sessionKey: 'tavern-draft-chat:1',
            startedAt: '2026-05-13T12:00:00.000Z',
            text: '',
        });
    });

    test('hides local thinking state after a draft fails', () => {
        expect(buildDraftActiveReply(createDraft({ status: 'error' }))).toBeNull();
    });

    test('keeps accepted turn identity after draft reconciliation', () => {
        expect(
            buildDraftActiveReply(
                createDraft({
                    realAcceptedAt: '2026-05-13T12:00:01.000Z',
                    realChatId: 'chat-1',
                    realRunId: 'run-1',
                    realSessionKey: 'session-1',
                    status: 'reconciled',
                })
            )
        ).toEqual({
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-13T12:00:01.000Z',
            text: '',
        });
    });
});
