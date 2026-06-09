import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import {
    buildChatRoutingConfiguredModelOptions,
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
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useChatStop } from '../../hooks/chats/use-chat-stop.ts';
import { useCapability } from '../../hooks/connections/use-capability.ts';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    normalizeMentions,
} from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import {
    type ChatComposerAttachment,
    ChatComposerAttachmentList,
    readComposerAttachment,
} from './chat-composer-attachments.tsx';
import { useChatComposerQueue } from './chat-composer-queue.ts';
import { ChatComposerQueuePanel } from './chat-composer-queue-panel.tsx';
import {
    ChatComposerAgentSelector,
    ChatComposerAttachmentButton,
    ChatComposerContextFullness,
    ChatComposerModelSelector,
} from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';
const runtimeDisconnectedTooltip = 'Tavern Runtime is disconnected.';

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
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const stopTurn = useChatStop();
    const gatewayCapability = useCapability('gateway');
    const modelList = useModelList();
    const composerQueue = useChatComposerQueue(chatId);
    const drainingQueueRef = React.useRef(false);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [agentId, setAgentId] = React.useState<string>(boundAgentIds[0] ?? '');
    const [attachments, setAttachments] = React.useState<ChatComposerAttachment[]>([]);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [content, setContent] = React.useState('');
    const [editingQueuedMessageId, setEditingQueuedMessageId] = React.useState<string | null>(null);
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [modelRef, setModelRef] = React.useState<string | null>(null);
    const modelOptions = React.useMemo(
        () => buildChatRoutingConfiguredModelOptions(modelList.data),
        [modelList.data]
    );
    const isCompact = variant === 'compact';
    const trimmedContent = content.trim();
    const hasPayload = trimmedContent.length > 0 || attachments.length > 0;
    const canSendToRuntime = gatewayCapability.healthy;
    const runtimeDisabledReason = runtimeDisconnectedTooltip;
    const isSendBlocked = sendMessage.isPending || isReplyActive;
    const canQueue =
        chatCanSend && canSendToRuntime && !isDisabled && agentId.length > 0 && hasPayload;
    const canSend = canQueue && !isSendBlocked;
    const canSubmit = isSendBlocked ? canQueue : canSend;
    const canDispatchQueued = chatCanSend && canSendToRuntime && !isDisabled && !isSendBlocked;

    React.useEffect(() => {
        if (!canDispatchQueued || drainingQueueRef.current) {
            return;
        }

        const entry = composerQueue.queue[0];

        if (!entry) {
            return;
        }

        drainingQueueRef.current = true;
        composerQueue.remove(entry.id);
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
                onSettled: () => {
                    drainingQueueRef.current = false;
                },
            }
        );
    }, [canDispatchQueued, chatId, composerQueue.queue, composerQueue.remove, sendMessage]);

    React.useEffect(() => {
        const nextAgentId = boundAgentIds[0] ?? '';

        if (!boundAgentIds.includes(agentId)) {
            setAgentId(nextAgentId);
        }
    }, [agentId, boundAgentIds]);

    const mentionComposer = useMentionComposer({
        agentId,
        agents,
        content,
        onTextChange: setContent,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
    });

    async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        if (!canSubmit) {
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
        if (isSendBlocked || sendMessage.isPending) {
            composerQueue.promote(id);
            return;
        }

        const entry = composerQueue.queue.find((queued) => queued.id === id);

        if (!entry) {
            return;
        }

        drainingQueueRef.current = true;
        composerQueue.remove(entry.id);
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
            error={attachmentError ?? sendMessage.error?.message}
            onDragOver={handleAttachmentDragOver}
            onDrop={handleAttachmentDrop}
            onSubmit={handleSubmit}
            onTextEditorFocus={mentionComposer.focusTextEditor}
            surfaceClassName={isCompact ? 'rounded-2xl shadow-none' : undefined}
        >
            <ChatComposerQueuePanel
                isBlocked={isSendBlocked}
                onEdit={handleEditQueuedMessage}
                onMove={composerQueue.move}
                onPromote={handlePromoteQueuedMessage}
                onRemove={composerQueue.remove}
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
                    composer={mentionComposer}
                    name="chat-message"
                    placeholder={getPlaceholder({ variant })}
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
                            aria-label="Stop response"
                            disabled={stopTurn.isPending}
                            onClick={() =>
                                stopTurn.mutate({
                                    chatId,
                                    runId: activeRunId,
                                })
                            }
                            size="icon-tight"
                            tooltip="Stop response"
                            type="button"
                            variant="secondary"
                        >
                            <Icon className="size-4" icon={Cancel01Icon} />
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

function getPlaceholder({ variant }: { variant: ChatMessageComposerVariant }) {
    return variant === 'compact' ? 'Send a message to this chat...' : 'Ask for follow-up changes';
}
