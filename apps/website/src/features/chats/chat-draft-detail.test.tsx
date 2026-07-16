import { describe, expect, test } from 'bun:test';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import {
    buildDraftActiveReply,
    buildDraftHandoffLog,
    canDraftUseSyncedComposer,
    isDraftReplyActive,
} from './chat-draft-detail.tsx';

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
        realTurnReference: null,
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
            runId: 'run_1_agent-1',
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
                    realTurnReference: 'asb_chat_1_agent_1_1',
                    status: 'reconciled',
                })
            )
        ).toEqual({
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'asb_chat_1_agent_1_1',
            startedAt: '2026-05-13T12:00:01.000Z',
            text: '',
        });
    });
});

describe('buildDraftHandoffLog', () => {
    test('exposes live handoff rows to the draft transcript', () => {
        const log = buildDraftHandoffLog({
            activeReplies: [
                {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-13T12:00:01.000Z',
                    text: '',
                },
            ],
            activeTurns: [],
            failedTurns: [],
            historyLoaded: false,
            timeline: [
                {
                    actor: { id: 'agent-1', kind: 'agent' },
                    completedAt: null,
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'act_run-1_tool',
                    isFirstInGroup: true,
                    kind: 'tool',
                    sessionKey: 'session-1',
                    spawnedRelationships: [],
                    startedAt: '2026-05-13T12:00:02.000Z',
                    toolCall: {
                        callId: 'call-1',
                        facts: [],
                        label: 'bash sleep 4',
                        name: 'bash',
                        status: null,
                        summaryParts: ['bash sleep 4'],
                    },
                },
            ],
            totalMessages: 1,
            terminalRunIds: [],
            turnEvidence: {},
        });

        expect(log?.rows.map((row) => row.id)).toEqual(['act_run-1_tool']);
        expect(log?.totalMessages).toBe(1);
    });
});

describe('canDraftUseSyncedComposer', () => {
    test('enables the queue-capable composer after draft reconciliation', () => {
        expect(
            canDraftUseSyncedComposer(
                createDraft({
                    realChatId: 'chat-1',
                    status: 'reconciled',
                })
            )
        ).toBe(true);
    });

    test('keeps the placeholder composer before the real chat exists', () => {
        expect(canDraftUseSyncedComposer(createDraft())).toBe(false);
    });

    test('does not enable sending for failed drafts', () => {
        expect(
            canDraftUseSyncedComposer(
                createDraft({
                    realChatId: 'chat-1',
                    status: 'error',
                })
            )
        ).toBe(false);
    });
});

describe('isDraftReplyActive', () => {
    test('treats reconciled active replies as queue-blocking', () => {
        expect(
            isDraftReplyActive({
                activeReplies: [
                    buildDraftActiveReply(
                        createDraft({
                            realChatId: 'chat-1',
                            realRunId: 'run-1',
                            status: 'reconciled',
                        })
                    ),
                ].filter((reply) => reply !== null),
                activeTurns: [],
                agentsPending: false,
                draft: createDraft({ status: 'reconciled' }),
            })
        ).toBe(true);
    });

    test('does not block after the handoff reply is complete', () => {
        expect(
            isDraftReplyActive({
                activeReplies: [{ isThinking: false }],
                activeTurns: [],
                agentsPending: false,
                draft: createDraft({ status: 'reconciled' }),
            })
        ).toBe(false);
    });
});
