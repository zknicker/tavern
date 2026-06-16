import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';
import { buildStartedChatDisplayName } from './chat-start-title.ts';

export type ChatStartDraftStatus = 'queued' | 'creating' | 'reconciled' | 'error';

export interface ChatStartDraft {
    agentId: string;
    attachments?: ChatMessageAttachmentInput[];
    clientMessageId: string;
    content: string;
    createdAt: string;
    errorMessage: string | null;
    id: string;
    metadata?: Record<string, unknown>;
    modelRef?: string;
    realAcceptedAt: string | null;
    realChatId: string | null;
    realRunId: string | null;
    realSessionKey: string | null;
    status: ChatStartDraftStatus;
    title: string;
}

interface CreateChatStartDraftInput {
    agentId: string;
    attachments?: ChatMessageAttachmentInput[];
    content: string;
    metadata?: Record<string, unknown>;
    modelRef?: string;
}

interface ChatStartDraftContextValue {
    createDraft: (input: CreateChatStartDraftInput) => ChatStartDraft;
    failDraft: (input: { draftId: string; errorMessage: string }) => void;
    getDraft: (draftId: string | null | undefined) => ChatStartDraft | null;
    getReconciledDraft: (chatId: string) => ChatStartDraft | null;
    listDrafts: () => ChatStartDraft[];
    markCreating: (draftId: string) => void;
    reconcileDraft: (input: {
        acceptedAt: string;
        chatId: string;
        draftId: string;
        runId: string;
        sessionKey: string | null;
    }) => void;
    removeReconciledDrafts: (chatId: string) => ChatStartDraft[];
    restoreDrafts: (drafts: ChatStartDraft[]) => void;
}

const ChatStartDraftContext = React.createContext<ChatStartDraftContextValue | null>(null);

export function ChatStartDraftProvider({ children }: PropsWithChildren) {
    const [drafts, setDrafts] = React.useState<Record<string, ChatStartDraft>>({});

    const createDraft = React.useCallback((input: CreateChatStartDraftInput) => {
        const content = input.content.trim();
        const titleContent = content || attachmentTitle(input.attachments);
        const draft: ChatStartDraft = {
            agentId: input.agentId,
            ...(input.attachments?.length ? { attachments: input.attachments } : {}),
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content,
            createdAt: new Date().toISOString(),
            errorMessage: null,
            id: `tavern-draft-chat:${crypto.randomUUID()}`,
            metadata: input.metadata,
            ...(input.modelRef ? { modelRef: input.modelRef } : {}),
            realAcceptedAt: null,
            realChatId: null,
            realRunId: null,
            realSessionKey: null,
            status: 'queued',
            title: buildStartedChatDisplayName(titleContent),
        };

        setDrafts((current) => ({
            ...current,
            [draft.id]: draft,
        }));

        return draft;
    }, []);

    const updateDraft = React.useCallback(
        (draftId: string, update: (draft: ChatStartDraft) => ChatStartDraft) => {
            setDrafts((current) => {
                const draft = current[draftId];

                if (!draft) {
                    return current;
                }

                return {
                    ...current,
                    [draftId]: update(draft),
                };
            });
        },
        []
    );

    const markCreating = React.useCallback(
        (draftId: string) => {
            updateDraft(draftId, (draft) => ({
                ...draft,
                errorMessage: null,
                status: 'creating',
            }));
        },
        [updateDraft]
    );

    const reconcileDraft = React.useCallback(
        (input: {
            acceptedAt: string;
            chatId: string;
            draftId: string;
            runId: string;
            sessionKey: string | null;
        }) => {
            updateDraft(input.draftId, (draft) => ({
                ...draft,
                errorMessage: null,
                realAcceptedAt: input.acceptedAt,
                realChatId: input.chatId,
                realRunId: input.runId,
                realSessionKey: input.sessionKey,
                status: 'reconciled',
            }));
        },
        [updateDraft]
    );

    const failDraft = React.useCallback(
        (input: { draftId: string; errorMessage: string }) => {
            updateDraft(input.draftId, (draft) => ({
                ...draft,
                errorMessage: input.errorMessage,
                status: 'error',
            }));
        },
        [updateDraft]
    );

    const getDraft = React.useCallback(
        (draftId: string | null | undefined) => (draftId ? (drafts[draftId] ?? null) : null),
        [drafts]
    );

    const getReconciledDraft = React.useCallback(
        (chatId: string) =>
            Object.values(drafts).find((draft) => draft.realChatId === chatId) ?? null,
        [drafts]
    );
    const listDrafts = React.useCallback(
        () =>
            Object.values(drafts).sort(
                (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
            ),
        [drafts]
    );
    const removeReconciledDrafts = React.useCallback(
        (chatId: string) => {
            const result = removeReconciledDraftsForChat(drafts, chatId);

            if (result.removedDrafts.length === 0) {
                return [];
            }

            setDrafts((current) => removeReconciledDraftsForChat(current, chatId).drafts);

            return result.removedDrafts;
        },
        [drafts]
    );
    const restoreDrafts = React.useCallback((removedDrafts: ChatStartDraft[]) => {
        if (removedDrafts.length === 0) {
            return;
        }

        setDrafts((current) => ({
            ...Object.fromEntries(removedDrafts.map((draft) => [draft.id, draft])),
            ...current,
        }));
    }, []);

    const value = React.useMemo<ChatStartDraftContextValue>(
        () => ({
            createDraft,
            failDraft,
            getDraft,
            getReconciledDraft,
            listDrafts,
            markCreating,
            reconcileDraft,
            removeReconciledDrafts,
            restoreDrafts,
        }),
        [
            createDraft,
            failDraft,
            getDraft,
            getReconciledDraft,
            listDrafts,
            markCreating,
            reconcileDraft,
            removeReconciledDrafts,
            restoreDrafts,
        ]
    );

    return React.createElement(ChatStartDraftContext.Provider, { value }, children);
}

export function useChatStartDrafts() {
    const context = React.useContext(ChatStartDraftContext);

    if (context === null) {
        throw new Error('useChatStartDrafts must be used within a ChatStartDraftProvider.');
    }

    return context;
}

export function removeReconciledDraftsForChat(
    drafts: Record<string, ChatStartDraft>,
    chatId: string
) {
    const removedDrafts = Object.values(drafts).filter((draft) => draft.realChatId === chatId);

    if (removedDrafts.length === 0) {
        return { drafts, removedDrafts };
    }

    const removedIds = new Set(removedDrafts.map((draft) => draft.id));
    const nextDrafts = Object.fromEntries(
        Object.entries(drafts).filter(([draftId]) => !removedIds.has(draftId))
    );

    return { drafts: nextDrafts, removedDrafts };
}

function attachmentTitle(attachments: readonly ChatMessageAttachmentInput[] | undefined) {
    const firstAttachment = attachments?.[0];
    return typeof firstAttachment?.filename === 'string'
        ? `Attachment: ${firstAttachment.filename}`
        : 'New chat';
}
