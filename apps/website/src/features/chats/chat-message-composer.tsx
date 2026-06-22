import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    buildChatRoutingConfiguredModelOptions,
    buildChatRoutingModelOptions,
    type ModelOptionItem,
} from '../../components/ui/model-route-shared.ts';
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
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    normalizeMentions,
} from '../mentions/mention-text.ts';
import type { ActiveMentionQuery, Mention, MentionOption } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import { useChatCommandRunner } from './chat-command.ts';
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
    ChatComposerAgentSelector,
    ChatComposerAttachmentButton,
    ChatComposerContextFullness,
    ChatComposerModelSelector,
} from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';
const CHAT_COMPOSER_PLACEHOLDER = "Let's go on an adventure...";

export function ChatMessageComposer({
    agentRuntimeSyncLabel = null,
    activeRunId = null,
    agents,
    blockReason = null,
    boundAgentIds,
    canSend: chatCanSend,
    chatId,
    contextFullness = null,
    isDisabled,
    isReplyActive,
    steerRunId = null,
    variant = 'detail',
}: {
    agentRuntimeSyncLabel?: string | null;
    activeRunId?: string | null;
    agents: AgentListOutput['agents'];
    blockReason?: string | null;
    boundAgentIds: string[];
    canSend: boolean;
    chatId: string;
    contextFullness?: ChatContextFullness | null;
    isDisabled: boolean;
    isReplyActive: boolean;
    steerRunId?: string | null;
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const steerTurn = useChatSteer();
    const stopTurn = useChatStop();
    const gatewayCapability = useCapability('gateway');
    const modelList = useModelList();
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
    const { agentId, attachments, content, editingQueuedMessageId, mentions, modelRef } =
        composerDraft.draft;
    const {
        setAgentId,
        setAttachments,
        setContent,
        setEditingQueuedMessageId,
        setMentions,
        setModelRef,
    } = composerDraft;
    const allModelOptions = React.useMemo(
        () => buildChatRoutingModelOptions(modelList.data),
        [modelList.data]
    );
    const modelOptions = React.useMemo(
        () => buildChatRoutingConfiguredModelOptions(modelList.data),
        [modelList.data]
    );
    const isCompact = variant === 'compact';
    const trimmedContent = content.trim();
    const hasPayload = trimmedContent.length > 0 || attachments.length > 0;
    const canSendToRuntime = gatewayCapability.healthy;
    const runtimeDisabledReason = runtimeUnhealthyTooltip;
    const isSendBlocked = sendMessage.isPending || isReplyActive;
    const isComposerBlocked = isDisabled || blockReason !== null;
    const canQueue =
        chatCanSend && canSendToRuntime && !isComposerBlocked && agentId.length > 0 && hasPayload;
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
        activeRunId,
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

    const chatCommands = useChatCommandRunner();
    const modelCommandOptions = React.useMemo(
        () => createModelCommandOptions(allModelOptions),
        [allModelOptions]
    );
    const resolveCommandArgumentOptions = React.useCallback(
        (query: ActiveMentionQuery) => {
            const modelQuery = getModelCommandArgumentQuery(query.query);

            if (modelQuery === null) {
                return null;
            }

            return filterModelCommandOptions(modelCommandOptions, modelQuery);
        },
        [modelCommandOptions]
    );
    const mentionComposer = useMentionComposer({
        agentId,
        agents,
        commandArgumentOptions: resolveCommandArgumentOptions,
        content,
        contextFullness,
        onCommandAction: (command) => {
            void handleCommandAction(command);
        },
        onTextChange: setContent,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
        supportsCommands: true,
    });

    async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        if (!canSubmit) {
            return;
        }

        // A known leading-slash command runs in the chat's session instead of
        // starting a turn; unknown slash text falls through and sends.
        if (chatCommands.isBareModelCommand(content)) {
            setContent('/model ');
            setMentions([]);
            mentionComposer.focusTextEditor();
            return;
        }

        if (chatCommands.matchCommand(content)) {
            const command = content.trim();
            await handleCommandAction(command);
            return;
        }

        const submission = buildChatComposerSubmission({ content, mentions });
        const submittedAttachments = attachments;
        const submittedModelRef = modelRef ?? undefined;
        setContent('');
        setMentions([]);
        setAttachments([]);
        setAttachmentError(null);

        if (editingQueuedMessageId || isSendBlocked) {
            composerQueue.enqueue({
                agentId,
                ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
                content: submission.content,
                metadata: submission.metadata,
                ...(submittedModelRef ? { modelRef: submittedModelRef } : {}),
            });
            setEditingQueuedMessageId(null);
            return;
        }

        await sendMessage.mutateAsync({
            agentId,
            ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
            chatId,
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content: submission.content,
            metadata: submission.metadata,
            ...(submittedModelRef ? { modelRef: submittedModelRef } : {}),
        });
    }

    function handlePromoteQueuedMessage(id: string) {
        const queueIndex = composerQueue.queue.findIndex((queued) => queued.id === id);
        const entry = composerQueue.queue[queueIndex];

        if (!entry) {
            return;
        }

        if (isSendBlocked || sendMessage.isPending) {
            if (steerRunId && isQueuedMessageSteerable(entry)) {
                void steerQueuedEntry(entry, steerRunId);
                return;
            }

            composerQueue.promote(id);
            if (
                shouldInterruptActiveTurnForQueuedMessage(entry) &&
                activeRunId &&
                !stopTurn.isPending
            ) {
                stopTurn.mutate({
                    chatId,
                    runId: activeRunId,
                });
            }
            return;
        }

        dispatchQueuedEntry(entry);
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
                metadata: entry.metadata,
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
                agentId: entry.agentId,
                ...(entry.attachments?.length ? { attachments: entry.attachments } : {}),
                chatId,
                clientMessageId: `msg_${crypto.randomUUID()}`,
                content: entry.content,
                metadata: entry.metadata,
                ...(entry.modelRef ? { modelRef: entry.modelRef } : {}),
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
        setModelRef(entry.modelRef ?? null);
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

    async function handleCommandAction(command: string) {
        setContent('');
        setMentions([]);
        await chatCommands.runCommand({
            agentId,
            chatId,
            command,
        });
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
        const metadata = buildMentionMetadata(submission.mentions);
        return {
            content: submission.content.trim(),
            metadata,
        };
    }

    return (
        <PromptInput
            className={cn(
                isCompact
                    ? 'border-t border-r-[3px] border-r-border/70 bg-chrome/40 px-3 py-3'
                    : null
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
                canSteerBlockedMessages={Boolean(steerRunId)}
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
                    <ChatComposerAgentSelector
                        agentId={agentId}
                        agents={agents}
                        boundAgentIds={boundAgentIds}
                        disabled={isComposerBlocked}
                        onAgentChange={setAgentId}
                    />
                    <ModelSelectorSlot
                        disabled={isComposerBlocked || !canSendToRuntime}
                        modelOptions={modelOptions}
                        modelRef={modelRef}
                        onModelChange={setModelRef}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    {contextFullness ? (
                        <ChatComposerContextFullness fullness={contextFullness} />
                    ) : null}
                    {primaryAction === 'stop' && activeRunId ? (
                        <PromptInputButton
                            aria-label={stopTurn.isPending ? 'Stopping response' : 'Stop response'}
                            disabled={stopTurn.isPending}
                            onClick={() =>
                                stopTurn.mutate({
                                    chatId,
                                    runId: activeRunId,
                                })
                            }
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
    activeRunId: string | null;
    hasDraftPayload: boolean;
    isReplyActive: boolean;
}) {
    return input.activeRunId && input.isReplyActive && !input.hasDraftPayload ? 'stop' : 'submit';
}

function ModelSelectorSlot({
    disabled,
    modelOptions,
    modelRef,
    onModelChange,
}: {
    disabled: boolean;
    modelOptions: readonly ModelOptionItem[];
    modelRef: string | null;
    onModelChange: (modelRef: string | null) => void;
}) {
    if (modelOptions.length === 0) {
        return null;
    }

    return (
        <ChatComposerModelSelector
            disabled={disabled}
            modelOptions={modelOptions}
            onModelChange={onModelChange}
            value={modelRef}
        />
    );
}

function createModelCommandOptions(models: readonly ModelOptionItem[]): MentionOption[] {
    return models.map((model) => {
        const provider = getModelProviderConfig(model.provider);

        return {
            action: {
                command: `/model ${model.value}`,
                kind: 'run-command',
            },
            description: `${model.value} · ${formatAvailabilityLabel(model.availability)}`,
            groupLabel: 'Models',
            id: `model-command:${model.value}`,
            insertText: `/model ${model.value}`,
            kind: 'command',
            label: model.label,
            projection: 'capability-reference',
            sourceLabel: provider.displayName,
        };
    });
}

function filterModelCommandOptions(options: MentionOption[], query: string) {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
        return options;
    }

    return options.filter((option) =>
        [option.label, option.description ?? '', option.sourceLabel ?? '']
            .join(' ')
            .toLowerCase()
            .includes(normalized)
    );
}

function getModelCommandArgumentQuery(query: string) {
    const match = /^model\s+(.*)$/iu.exec(query);

    return match ? (match[1] ?? '') : null;
}

function formatAvailabilityLabel(availability: ModelOptionItem['availability']) {
    switch (availability) {
        case 'configured':
            return 'configured';
        case 'available':
            return 'available';
    }
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
