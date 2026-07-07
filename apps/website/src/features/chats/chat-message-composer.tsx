import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../commands/chat-composer-focus.ts';
import { Icon } from '../../components/ui/icon.tsx';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useChatSteer } from '../../hooks/chats/use-chat-steer.ts';
import { useChatStop } from '../../hooks/chats/use-chat-stop.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import { getDesktopBridge } from '../../lib/desktop-bridge.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { compileMentionSubmission, normalizeMentions } from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import {
    ChatComposerAttachmentList,
    readComposerAttachment,
} from './chat-composer-attachments.tsx';
import { useChatComposerDraftState } from './chat-composer-draft-state.ts';
import { useComposerFileDrop } from './chat-composer-file-drop.ts';
import { ChatComposerMainDropOverlay } from './chat-composer-main-drop-overlay.tsx';
import {
    type ChatComposerQueuedMessage,
    canStartQueuedSteer,
    hasPendingSteerAtQueueHead,
    isQueuedMessageSteerable,
    removeStoredQueuedMessage,
    reorderVisibleQueuedMessages,
    shouldInterruptActiveTurnForQueuedMessage,
    useChatComposerQueue,
} from './chat-composer-queue.ts';
import { ChatComposerQueuePanel } from './chat-composer-queue-panel.tsx';
import {
    ChatComposerAttachmentButton,
    ChatComposerContextFullness,
} from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';
import { resolveSteerRunId, type SteerableTurnTarget } from './chat-steering.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';
const CHAT_COMPOSER_PLACEHOLDER = "Let's go on an adventure...";

export function ChatMessageComposer({
    agentRuntimeSyncLabel = null,
    activeRunIds = [],
    agents,
    blockReason = null,
    boundAgentIds,
    canSend: chatCanSend,
    chatId,
    conversationKind,
    contextFullness = null,
    isDisabled,
    isReplyActive,
    steerTargets = [],
    variant = 'detail',
}: {
    agentRuntimeSyncLabel?: string | null;
    activeRunIds?: readonly string[];
    agents: AgentListOutput['agents'];
    blockReason?: string | null;
    boundAgentIds: string[];
    canSend: boolean;
    chatId: string;
    conversationKind: string;
    contextFullness?: ChatContextFullness | null;
    isDisabled: boolean;
    isReplyActive: boolean;
    steerTargets?: readonly SteerableTurnTarget[];
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const steerTurn = useChatSteer();
    const stopTurn = useChatStop();
    const gatewayCapability = useCapability('gateway');
    const composerQueue = useChatComposerQueue(chatId);
    const composerDraft = useChatComposerDraftState({ boundAgentIds, chatId });
    const drainingQueueRef = React.useRef(false);
    const failedQueuedDispatchIdsRef = React.useRef(new Set<string>());
    const pendingSteerQueuedIdsRef = React.useRef(new Set<string>());
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [pendingSteerQueuedIds, setPendingSteerQueuedIds] = React.useState<ReadonlySet<string>>(
        () => new Set()
    );
    const { agentId, attachments, content, editingQueuedMessageId, mentions } = composerDraft.draft;
    const { setAgentId, setAttachments, setContent, setEditingQueuedMessageId, setMentions } =
        composerDraft;
    const isCompact = variant === 'compact';
    const isAgentDm = conversationKind === 'direct';
    const trimmedContent = content.trim();
    const hasPayload = trimmedContent.length > 0 || attachments.length > 0;
    const canSendToRuntime = gatewayCapability.healthy;
    const runtimeDisabledReason = runtimeUnhealthyTooltip;
    const isSendBlocked = sendMessage.isPending || isReplyActive;
    const isComposerBlocked = isDisabled || blockReason !== null;
    const canQueue =
        chatCanSend &&
        canSendToRuntime &&
        !isComposerBlocked &&
        (!isAgentDm || agentId.length > 0) &&
        hasPayload;
    const canSend = canQueue && !isSendBlocked;
    const canSubmit = isSendBlocked ? canQueue : canSend;
    const canDispatchQueued =
        chatCanSend && canSendToRuntime && !isComposerBlocked && !isSendBlocked;
    const visibleQueuedMessages = React.useMemo(
        () => composerQueue.queue.filter((entry) => !pendingSteerQueuedIds.has(entry.id)),
        [composerQueue.queue, pendingSteerQueuedIds]
    );
    const isQueueDrainBlockedByPendingSteer = hasPendingSteerAtQueueHead(
        composerQueue.queue,
        pendingSteerQueuedIds
    );
    const primaryAction = getComposerPrimaryAction({
        hasActiveRun: activeRunIds.length > 0,
        hasDraftPayload: hasPayload,
        isReplyActive,
    });
    const useMainDropTarget = !isCompact;
    const attachmentDrop = useComposerFileDrop({
        disabled: isComposerBlocked || !canSendToRuntime,
        onFiles: addSelectedAttachments,
        target: useMainDropTarget ? 'main' : 'self',
    });

    // biome-ignore lint/correctness/useExhaustiveDependencies: Dispatch is ref-gated; visible queue head and blocked state drive this effect.
    React.useEffect(() => {
        if (!canDispatchQueued || drainingQueueRef.current || isQueueDrainBlockedByPendingSteer) {
            return;
        }

        const entry = visibleQueuedMessages[0];

        if (!entry || failedQueuedDispatchIdsRef.current.has(entry.id)) {
            return;
        }

        dispatchQueuedEntry(entry);
    }, [canDispatchQueued, isQueueDrainBlockedByPendingSteer, visibleQueuedMessages]);

    React.useEffect(() => {
        const queuedIds = new Set(composerQueue.queue.map((entry) => entry.id));

        for (const id of failedQueuedDispatchIdsRef.current) {
            if (!queuedIds.has(id)) {
                failedQueuedDispatchIdsRef.current.delete(id);
            }
        }

        const nextPendingSteerQueuedIds = new Set<string>();

        for (const id of pendingSteerQueuedIdsRef.current) {
            if (queuedIds.has(id)) {
                nextPendingSteerQueuedIds.add(id);
            }
        }

        if (nextPendingSteerQueuedIds.size !== pendingSteerQueuedIdsRef.current.size) {
            pendingSteerQueuedIdsRef.current = nextPendingSteerQueuedIds;
            setPendingSteerQueuedIds(nextPendingSteerQueuedIds);
        }
    }, [composerQueue.queue]);

    const mentionComposer = useMentionComposer({
        agentId,
        agents,
        content,
        mentionableAgentIds: boundAgentIds,
        onTextChange: setContent,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
    });
    const focusTextEditorRef = React.useRef(mentionComposer.focusTextEditor);
    focusTextEditorRef.current = mentionComposer.focusTextEditor;
    const canAutoFocusComposer = variant === 'detail' && !isComposerBlocked && canSendToRuntime;
    const chatAutoFocusKey = canAutoFocusComposer ? chatId : null;

    React.useEffect(() => {
        if (!chatAutoFocusKey) {
            return;
        }

        const frame = requestAnimationFrame(() => focusTextEditorRef.current());
        return () => cancelAnimationFrame(frame);
    }, [chatAutoFocusKey]);

    React.useEffect(() => {
        if (!canAutoFocusComposer) {
            return;
        }

        return getDesktopBridge()?.onViewActivated?.(() => {
            focusTextEditorRef.current();
        });
    }, [canAutoFocusComposer]);
    useChatComposerFocusRequest(canAutoFocusComposer, mentionComposer.focusTextEditor);

    async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        if (!canSubmit) {
            return;
        }

        const submission = buildChatComposerSubmission({ content, mentions });
        const submittedAttachments = attachments;
        setContent('');
        setMentions([]);
        setAttachments([]);
        setAttachmentError(null);

        if (editingQueuedMessageId || isSendBlocked) {
            const mentionAgentIds = mentions
                .filter((mention) => mention.kind === 'agent')
                .map((mention) => mention.id);

            composerQueue.enqueue({
                agentId,
                ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
                content: submission.content,
                ...(mentionAgentIds.length > 0 ? { mentionAgentIds } : {}),
            });
            setEditingQueuedMessageId(null);
            return;
        }

        await sendMessage.mutateAsync({
            ...(isAgentDm ? { agentId } : {}),
            ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
            chatId,
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content: submission.content,
        });
    }

    function handlePromoteQueuedMessage(id: string) {
        const queueIndex = composerQueue.queue.findIndex((queued) => queued.id === id);
        const entry = composerQueue.queue[queueIndex];

        if (!entry) {
            return;
        }

        if (isSendBlocked || sendMessage.isPending) {
            const steerRunId = resolveSteerRunId(steerTargets, {
                mentionAgentIds: entry.mentionAgentIds,
            });

            if (steerRunId && isQueuedMessageSteerable(entry)) {
                void steerQueuedEntry(entry, steerRunId);
                return;
            }

            composerQueue.promote(id);
            if (
                shouldInterruptActiveTurnForQueuedMessage(entry) &&
                activeRunIds.length > 0 &&
                !stopTurn.isPending
            ) {
                stopActiveRuns();
            }
            return;
        }

        dispatchQueuedEntry(entry);
    }

    function stopActiveRuns() {
        for (const runId of activeRunIds) {
            stopTurn.mutate({ chatId, runId });
        }
    }

    async function steerQueuedEntry(entry: ChatComposerQueuedMessage, runId: string) {
        if (
            !canStartQueuedSteer({
                pendingSteerIds: pendingSteerQueuedIdsRef.current,
                steerPending: steerTurn.isPending,
            })
        ) {
            return;
        }

        setQueuedSteerPending(entry.id, true);

        try {
            const result = await steerTurn.mutateAsync({
                chatId,
                content: entry.content,
                runId,
            });

            if (result.steered) {
                removeStoredQueuedMessage(chatId, entry.id);
                composerQueue.remove(entry.id);
                setQueuedSteerPending(entry.id, false);
                return;
            }
        } catch {
            setQueuedSteerPending(entry.id, false);
            return;
        }

        setQueuedSteerPending(entry.id, false);
    }

    function dispatchQueuedEntry(entry: ChatComposerQueuedMessage) {
        if (drainingQueueRef.current) {
            return;
        }

        failedQueuedDispatchIdsRef.current.delete(entry.id);
        drainingQueueRef.current = true;
        sendMessage.mutate(
            {
                ...(isAgentDm ? { agentId: entry.agentId } : {}),
                ...(entry.attachments?.length ? { attachments: entry.attachments } : {}),
                chatId,
                clientMessageId: `msg_${crypto.randomUUID()}`,
                content: entry.content,
            },
            {
                onError: () => {
                    failedQueuedDispatchIdsRef.current.add(entry.id);
                },
                onSuccess: () => {
                    composerQueue.remove(entry.id);
                },
                onSettled: () => {
                    drainingQueueRef.current = false;
                },
            }
        );
    }

    function handleEditQueuedMessage(id: string) {
        const entry = composerQueue.queue.find((queued) => queued.id === id);

        if (!entry) {
            return;
        }

        composerQueue.remove(entry.id);
        setEditingQueuedMessageId(entry.id);
        setAgentId(entry.agentId);
        setContent(entry.content);
        setMentions([]);
        setAttachments(entry.attachments ?? []);
        setAttachmentError(null);
        mentionComposer.focusTextEditor();
    }

    function handleReorderQueuedMessages(nextQueue: readonly ChatComposerQueuedMessage[]) {
        composerQueue.reorder(
            reorderVisibleQueuedMessages(composerQueue.queue, nextQueue, pendingSteerQueuedIds)
        );
    }

    function setQueuedSteerPending(id: string, pending: boolean) {
        if (pendingSteerQueuedIdsRef.current.has(id) === pending) {
            return;
        }

        const nextIds = new Set(pendingSteerQueuedIdsRef.current);

        if (pending) {
            nextIds.add(id);
        } else {
            nextIds.delete(id);
        }

        pendingSteerQueuedIdsRef.current = nextIds;
        setPendingSteerQueuedIds(nextIds);
    }

    async function handleAttachmentInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = '';

        if (files.length === 0) {
            return;
        }

        await addSelectedAttachments(files);
    }

    async function addSelectedAttachments(files: File[]) {
        try {
            setAttachmentError(null);
            const nextAttachments = await Promise.all(files.map(readComposerAttachment));
            setAttachments((current) => [...current, ...nextAttachments]);
        } catch (error) {
            setAttachmentError(
                error instanceof Error ? error.message : 'Could not read attachments.'
            );
        }
    }

    function buildChatComposerSubmission({
        content,
        mentions,
    }: {
        content: string;
        mentions: Mention[];
    }) {
        const leadingTrimLength = content.length - content.trimStart().length;
        const submittedContent = content.trimStart();
        const submittedMentions = normalizeMentions(
            submittedContent,
            mentions.map((mention) => ({
                ...mention,
                end: mention.end - leadingTrimLength,
                start: mention.start - leadingTrimLength,
            }))
        );
        const submission = compileMentionSubmission(submittedContent, submittedMentions);
        return {
            content: submission.content.trim(),
        };
    }

    return (
        <PromptInput
            className={cn(
                isCompact
                    ? 'border-t border-r-[3px] border-r-border/70 bg-chrome/40 px-3 py-3'
                    : // Match the transcript's lg gutter so the composer stays
                      // aligned with the messages.
                      'lg:px-16'
            )}
            contentClassName={isCompact ? 'max-w-none' : undefined}
            error={attachmentError ?? steerTurn.error?.message ?? sendMessage.error?.message}
            onDragEnter={useMainDropTarget ? undefined : attachmentDrop.onDragEnter}
            onDragLeave={useMainDropTarget ? undefined : attachmentDrop.onDragLeave}
            onDragOver={useMainDropTarget ? undefined : attachmentDrop.onDragOver}
            onDrop={useMainDropTarget ? undefined : attachmentDrop.onDrop}
            onSubmit={handleSubmit}
            onTextEditorFocus={isComposerBlocked ? undefined : mentionComposer.focusTextEditor}
            surfaceClassName={cn(
                isCompact ? 'rounded-2xl shadow-none' : undefined,
                isCompact &&
                    attachmentDrop.isFileDropActive &&
                    'border-ring/35 bg-accent/10 shadow-md shadow-ring/10 ring-2 ring-ring/35',
                isComposerBlocked && 'cursor-not-allowed opacity-60'
            )}
        >
            <ChatComposerMainDropOverlay
                active={useMainDropTarget && attachmentDrop.isFileDropActive}
            />
            <ChatComposerQueuePanel
                canSteerBlockedMessages={steerTargets.length > 0}
                isBlocked={isSendBlocked}
                onEdit={handleEditQueuedMessage}
                onMove={composerQueue.move}
                onPromote={handlePromoteQueuedMessage}
                onRemove={composerQueue.remove}
                onReorder={handleReorderQueuedMessages}
                queue={visibleQueuedMessages}
            />
            <ChatComposerAttachmentList
                attachments={attachments}
                onRemove={(index) => {
                    setAttachments((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index)
                    );
                    setAttachmentError(null);
                }}
            />
            <PromptInputBody>
                <MentionComposerEditor
                    ariaLabel="Chat message"
                    autoFocus={variant === 'detail'}
                    composer={mentionComposer}
                    disabled={isComposerBlocked || !canSendToRuntime}
                    name="chat-message"
                    placeholder={CHAT_COMPOSER_PLACEHOLDER}
                />
            </PromptInputBody>
            <MentionComposerPicker composer={mentionComposer} />
            <PromptInputFooter>
                <PromptInputTools>
                    <input
                        className="sr-only"
                        multiple
                        onChange={(event) => {
                            void handleAttachmentInputChange(event);
                        }}
                        ref={fileInputRef}
                        type="file"
                    />
                    <ChatComposerAttachmentButton
                        disabled={isComposerBlocked || !canSendToRuntime}
                        onClick={() => fileInputRef.current?.click()}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    {contextFullness ? (
                        <ChatComposerContextFullness fullness={contextFullness} />
                    ) : null}
                    {primaryAction === 'stop' && activeRunIds.length > 0 ? (
                        <PromptInputButton
                            aria-label={stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                            disabled={stopTurn.isPending}
                            onClick={stopActiveRuns}
                            size="icon-tight"
                            tooltip={stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                            type="button"
                        >
                            {stopTurn.isPending ? (
                                <Spinner className="size-4 text-muted-foreground" />
                            ) : (
                                <Icon className="size-5" icon={StopIcon} />
                            )}
                        </PromptInputButton>
                    ) : (
                        <PromptInputSubmit
                            canSubmit={canSubmit}
                            label={
                                !isComposerBlocked &&
                                (editingQueuedMessageId || isSendBlocked) &&
                                hasPayload
                                    ? 'Queue message'
                                    : 'Send message'
                            }
                            tooltip={getSendDisabledTooltip({
                                agentRuntimeSyncLabel,
                                boundAgentCount: boundAgentIds.length,
                                blockReason,
                                canSend: chatCanSend,
                                isDisabled,
                                isPending: sendMessage.isPending,
                                isReplyActive,
                                runtimeReady: canSendToRuntime,
                                runtimeReason: runtimeDisabledReason,
                            })}
                        />
                    )}
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
}

export function getComposerPrimaryAction(input: {
    hasActiveRun: boolean;
    hasDraftPayload: boolean;
    isReplyActive: boolean;
}) {
    return input.hasActiveRun && input.isReplyActive && !input.hasDraftPayload ? 'stop' : 'submit';
}

function getSendDisabledTooltip({
    agentRuntimeSyncLabel,
    blockReason,
    boundAgentCount,
    canSend,
    isDisabled,
    isPending,
    isReplyActive,
    runtimeReady,
    runtimeReason,
}: {
    agentRuntimeSyncLabel: string | null;
    blockReason: string | null;
    boundAgentCount: number;
    canSend: boolean;
    isDisabled: boolean;
    isPending: boolean;
    isReplyActive: boolean;
    runtimeReady: boolean;
    runtimeReason: string;
}) {
    if (isPending) {
        return 'Sending message...';
    }

    if (blockReason) {
        return blockReason;
    }

    if (isReplyActive) {
        return undefined;
    }

    if (boundAgentCount === 0) {
        return 'Bind an agent before sending.';
    }

    if (isDisabled) {
        return agentRuntimeSyncLabel ?? 'Chat is not ready for sending.';
    }

    if (!runtimeReady) {
        return runtimeReason;
    }

    if (!canSend) {
        return 'This chat does not have a synced session for sending.';
    }

    return undefined;
}
