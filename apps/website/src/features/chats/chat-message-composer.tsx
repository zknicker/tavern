import { StopIcon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';
import { useChatComposerFocusRequest } from '../../commands/chat-composer-focus.ts';
import {
    appendComposerInsert,
    useChatComposerInsertRequest,
} from '../../commands/chat-composer-insert.ts';
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
    ChatComposerAttachmentButton,
    ChatComposerContextFullness,
} from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

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
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const stopTurn = useChatStop();
    const gatewayCapability = useCapability('gateway');
    const composerDraft = useChatComposerDraftState({ boundAgentIds, chatId });
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const { agentId, attachments, content, mentions } = composerDraft.draft;
    const { setAttachments, setContent, setMentions } = composerDraft;
    const isCompact = variant === 'compact';
    const isAgentDm = conversationKind === 'direct';
    const trimmedContent = content.trim();
    const hasPayload = trimmedContent.length > 0 || attachments.length > 0;
    const canSendToRuntime = gatewayCapability.healthy;
    const runtimeDisabledReason = runtimeUnhealthyTooltip;
    const isComposerBlocked = isDisabled || blockReason !== null;
    // Sending while a turn is live is a normal send: the message is durable
    // and Runtime handles mid-turn delivery. Only an in-flight send blocks.
    const canSubmit =
        chatCanSend &&
        canSendToRuntime &&
        !isComposerBlocked &&
        (!isAgentDm || agentId.length > 0) &&
        hasPayload &&
        !sendMessage.isPending;
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
    const handleComposerInsert = React.useCallback(
        (text: string) => {
            setContent((current) => appendComposerInsert(current, text));
            requestAnimationFrame(() => focusTextEditorRef.current());
        },
        [setContent]
    );
    useChatComposerInsertRequest(canAutoFocusComposer, handleComposerInsert);

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

        await sendMessage.mutateAsync({
            ...(isAgentDm ? { agentId } : {}),
            ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
            chatId,
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content: submission.content,
        });
    }

    function stopActiveRuns() {
        for (const runId of activeRunIds) {
            stopTurn.mutate({ chatId, runId });
        }
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
                    : // Match the transcript's gutter so the composer stays
                      // aligned with the messages.
                      'px-5'
            )}
            contentClassName="max-w-none"
            error={attachmentError ?? sendMessage.error?.message}
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
                            label="Send message"
                            tooltip={getSendDisabledTooltip({
                                agentRuntimeSyncLabel,
                                boundAgentCount: boundAgentIds.length,
                                blockReason,
                                canSend: chatCanSend,
                                isDisabled,
                                isPending: sendMessage.isPending,
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
    runtimeReady,
    runtimeReason,
}: {
    agentRuntimeSyncLabel: string | null;
    blockReason: string | null;
    boundAgentCount: number;
    canSend: boolean;
    isDisabled: boolean;
    isPending: boolean;
    runtimeReady: boolean;
    runtimeReason: string;
}) {
    if (isPending) {
        return 'Sending message...';
    }

    if (blockReason) {
        return blockReason;
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
