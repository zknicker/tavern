import * as React from 'react';
import type { Mention } from '../mentions/mention-types.ts';
import type { ChatComposerAttachment } from './chat-composer-attachments.tsx';

export interface ChatComposerDraftState {
    agentId: string;
    attachments: ChatComposerAttachment[];
    content: string;
    editingQueuedMessageId: string | null;
    mentions: Mention[];
    modelRef: string | null;
}

type DraftValue<T> = T | ((current: T) => T);

const composerDrafts = new Map<string, ChatComposerDraftState>();

export function useChatComposerDraftState({
    boundAgentIds,
    chatId,
}: {
    boundAgentIds: readonly string[];
    chatId: string;
}) {
    const [snapshot, setSnapshot] = React.useState(() => ({
        chatId,
        draft: readChatComposerDraft(chatId, boundAgentIds),
    }));
    const draft =
        snapshot.chatId === chatId ? snapshot.draft : readChatComposerDraft(chatId, boundAgentIds);

    React.useEffect(() => {
        setSnapshot({
            chatId,
            draft: readChatComposerDraft(chatId, boundAgentIds),
        });
    }, [boundAgentIds, chatId]);

    React.useEffect(() => {
        if (snapshot.chatId !== chatId) {
            return;
        }

        writeChatComposerDraft(snapshot.chatId, snapshot.draft);
    }, [chatId, snapshot]);

    const updateDraft = React.useCallback(
        (update: DraftValue<ChatComposerDraftState>) => {
            setSnapshot((current) => {
                const currentDraft =
                    current.chatId === chatId
                        ? current.draft
                        : readChatComposerDraft(chatId, boundAgentIds);
                const next = normalizeChatComposerDraft(
                    typeof update === 'function' ? update(currentDraft) : update,
                    boundAgentIds
                );
                return { chatId, draft: next };
            });
        },
        [boundAgentIds, chatId]
    );

    const setAgentId = React.useCallback(
        (value: DraftValue<string>) => {
            updateDraft((current) => ({
                ...current,
                agentId: resolveDraftValue(value, current.agentId),
            }));
        },
        [updateDraft]
    );

    const setAttachments = React.useCallback(
        (value: DraftValue<ChatComposerAttachment[]>) => {
            updateDraft((current) => ({
                ...current,
                attachments: resolveDraftValue(value, current.attachments),
            }));
        },
        [updateDraft]
    );

    const setContent = React.useCallback(
        (value: DraftValue<string>) => {
            updateDraft((current) => ({
                ...current,
                content: resolveDraftValue(value, current.content),
            }));
        },
        [updateDraft]
    );

    const setEditingQueuedMessageId = React.useCallback(
        (value: DraftValue<string | null>) => {
            updateDraft((current) => ({
                ...current,
                editingQueuedMessageId: resolveDraftValue(value, current.editingQueuedMessageId),
            }));
        },
        [updateDraft]
    );

    const setMentions = React.useCallback(
        (value: DraftValue<Mention[]>) => {
            updateDraft((current) => ({
                ...current,
                mentions: resolveDraftValue(value, current.mentions),
            }));
        },
        [updateDraft]
    );

    const setModelRef = React.useCallback(
        (value: DraftValue<string | null>) => {
            updateDraft((current) => ({
                ...current,
                modelRef: resolveDraftValue(value, current.modelRef),
            }));
        },
        [updateDraft]
    );

    return {
        draft,
        setAgentId,
        setAttachments,
        setContent,
        setEditingQueuedMessageId,
        setMentions,
        setModelRef,
    };
}

export function createChatComposerDraftState(
    boundAgentIds: readonly string[]
): ChatComposerDraftState {
    return {
        agentId: boundAgentIds[0] ?? '',
        attachments: [],
        content: '',
        editingQueuedMessageId: null,
        mentions: [],
        modelRef: null,
    };
}

export function normalizeChatComposerDraft(
    draft: ChatComposerDraftState,
    boundAgentIds: readonly string[]
): ChatComposerDraftState {
    if (boundAgentIds.includes(draft.agentId)) {
        return draft;
    }

    return {
        ...draft,
        agentId: boundAgentIds[0] ?? '',
    };
}

export function readChatComposerDraft(
    chatId: string,
    boundAgentIds: readonly string[]
): ChatComposerDraftState {
    const draft = composerDrafts.get(chatId) ?? createChatComposerDraftState(boundAgentIds);
    return normalizeChatComposerDraft(cloneChatComposerDraft(draft), boundAgentIds);
}

export function writeChatComposerDraft(chatId: string, draft: ChatComposerDraftState) {
    composerDrafts.set(chatId, cloneChatComposerDraft(draft));
}

export function clearChatComposerDraftsForTest() {
    composerDrafts.clear();
}

function cloneChatComposerDraft(draft: ChatComposerDraftState): ChatComposerDraftState {
    return {
        ...draft,
        attachments: [...draft.attachments],
        mentions: draft.mentions.map((mention) => ({ ...mention })),
    };
}

function resolveDraftValue<T>(value: DraftValue<T>, current: T) {
    return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}
