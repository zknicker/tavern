import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
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
    type ChatComposerAttachment,
    ChatComposerAttachmentList,
    readComposerAttachment,
} from './chat-composer-attachments.tsx';
import {
    type ChatComposerQueuedMessage,
    isQueuedMessageSteerable,
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
    const drainingQueueRef = React.useRef(false);
    const failedQueuedDispatchIdsRef = React.useRef(new Set<string>());
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [agentId, setAgentId] = React.useState<string>(boundAgentIds[0] ?? '');
    const [attachments, setAttachments] = React.useState<ChatComposerAttachment[]>([]);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [content, setContent] = React.useState('');
    const [editingQueuedMessageId, setEditingQueuedMessageId] = React.useState<string | null>(null);
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [modelRef, setModelRef] = React.useState<string | null>(null);
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
    const canQueue =
        chatCanSend && canSendToRuntime && !isDisabled && agentId.length > 0 && hasPayload;
    const canSend = canQueue && !isSendBlocked;
    const canSubmit = isSendBlocked ? canQueue : canSend;
    const canDispatchQueued = chatCanSend && canSendToRuntime && !isDisabled && !isSendBlocked;

    // biome-ignore lint/correctness/useExhaustiveDependencies: Dispatch is ref-gated; queue head and blocked state drive this effect.
    React.useEffect(() => {
        if (!canDispatchQueued || drainingQueueRef.current) {
            return;
        }

        const entry = composerQueue.queue[0];

        if (!entry || failedQueuedDispatchIdsRef.current.has(entry.id)) {
            return;
        }

        dispatchQueuedEntry(entry);
    }, [canDispatchQueued, composerQueue.queue]);

    React.useEffect(() => {
        const queuedIds = new Set(composerQueue.queue.map((entry) => entry.id));

        for (const id of failedQueuedDispatchIdsRef.current) {
            if (!queuedIds.has(id)) {
                failedQueuedDispatchIdsRef.current.delete(id);
            }
        }
    }, [composerQueue.queue]);

    React.useEffect(() => {
        const nextAgentId = boundAgentIds[0] ?? '';

        if (!boundAgentIds.includes(agentId)) {
            setAgentId(nextAgentId);
        }
    }, [agentId, boundAgentIds]);

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
        const entry = composerQueue.queue.find((queued) => queued.id === id);

        if (!entry) {
            return;
        }

        if (isSendBlocked || sendMessage.isPending) {
            if (steerRunId && isQueuedMessageSteerable(entry)) {
                if (steerTurn.isPending) {
                    return;
                }

                steerTurn.mutate(
                    {
                        chatId,
                        content: entry.content,
                        metadata: entry.metadata,
                        runId: steerRunId,
                    },
                    {
                        onSuccess: (result) => {
                            if (result.steered) {
                                composerQueue.remove(entry.id);
                            }
                        },
                    }
                );
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

    async function handleAttachmentInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = '';

        if (files.length === 0) {
            return;
        }

        await addSelectedAttachments(files);
    }

    function handleAttachmentDragOver(event: React.DragEvent<HTMLFormElement>) {
        if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
        }
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

    function handleAttachmentDrop(event: React.DragEvent<HTMLFormElement>) {
        const files = [...event.dataTransfer.files];

        if (files.length === 0) {
            return;
        }

        event.preventDefault();
        void addSelectedAttachments(files);
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
            onDragOver={handleAttachmentDragOver}
            onDrop={handleAttachmentDrop}
            onSubmit={handleSubmit}
            onTextEditorFocus={mentionComposer.focusTextEditor}
            surfaceClassName={isCompact ? 'rounded-2xl shadow-none' : undefined}
        >
            <ChatComposerQueuePanel
                canSteerBlockedMessages={Boolean(steerRunId)}
                isBlocked={isSendBlocked}
                onEdit={handleEditQueuedMessage}
                onMove={composerQueue.move}
                onPromote={handlePromoteQueuedMessage}
                onRemove={composerQueue.remove}
                onReorder={composerQueue.reorder}
                queue={composerQueue.queue}
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
                        disabled={isDisabled || !canSendToRuntime}
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <ChatComposerAgentSelector
                        agentId={agentId}
                        agents={agents}
                        boundAgentIds={boundAgentIds}
                        onAgentChange={setAgentId}
                    />
                    <ModelSelectorSlot
                        disabled={isDisabled || !canSendToRuntime}
                        modelOptions={modelOptions}
                        modelRef={modelRef}
                        onModelChange={setModelRef}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    {contextFullness ? (
                        <ChatComposerContextFullness fullness={contextFullness} />
                    ) : null}
                    {activeRunId ? (
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
                            variant="secondary"
                        >
                            {stopTurn.isPending ? (
                                <Spinner className="size-4 text-muted-foreground" />
                            ) : (
                                <Icon className="size-4" icon={Cancel01Icon} />
                            )}
                        </PromptInputButton>
                    ) : null}
                    <PromptInputSubmit
                        canSubmit={canSubmit}
                        label={
                            (editingQueuedMessageId || isSendBlocked) && hasPayload
                                ? 'Queue message'
                                : 'Send message'
                        }
                        tooltip={getSendDisabledTooltip({
                            agentRuntimeSyncLabel,
                            boundAgentCount: boundAgentIds.length,
                            canSend: chatCanSend,
                            isDisabled,
                            isPending: sendMessage.isPending,
                            isReplyActive,
                            runtimeReady: canSendToRuntime,
                            runtimeReason: runtimeDisabledReason,
                        })}
                    />
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
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
    boundAgentCount,
    canSend,
    isDisabled,
    isPending,
    isReplyActive,
    runtimeReady,
    runtimeReason,
}: {
    agentRuntimeSyncLabel: string | null;
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
