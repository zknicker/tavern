import * as React from 'react';
import {
    buildChatRoutingConfiguredModelOptions,
    type ModelOptionItem,
} from '../../components/ui/model-route-shared.ts';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
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
import { useComposerFileDrop } from './chat-composer-file-drop.ts';
import { handleChatComposerKeyDown } from './chat-composer-keyboard.ts';
import { ChatComposerMainDropOverlay } from './chat-composer-main-drop-overlay.tsx';
import { ChatComposerAttachmentButton, ChatComposerModelSelector } from './chat-composer-tools.tsx';

type Agent = AgentListOutput['agents'][number];
const CHAT_COMPOSER_PLACEHOLDER = "Let's go on an adventure...";

export function StartChatComposer({
    agent,
    className,
    density = 'overview',
    id,
}: {
    agent: Agent | null;
    className?: string;
    density?: 'agent' | 'overview';
    id?: string;
}) {
    const launchChatDraft = useChatDraftLaunch();
    const gatewayCapability = useCapability('gateway');
    const apiCapability = useCapability('apiServer');
    const modelList = useModelList();
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [attachments, setAttachments] = React.useState<ChatComposerAttachment[]>([]);
    const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
    const [modelRef, setModelRef] = React.useState<string | null>(null);
    const [prompt, setPrompt] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const modelOptions = React.useMemo(
        () => buildChatRoutingConfiguredModelOptions(modelList.data),
        [modelList.data]
    );

    const canSendToRuntime = gatewayCapability.healthy && apiCapability.healthy;
    const canUseMentions = Boolean(agent);
    const isPromptReady = (prompt.trim().length > 0 || attachments.length > 0) && agent !== null;
    const canSubmit = isPromptReady && canSendToRuntime;
    const runtimeDisabledReason = runtimeUnhealthyTooltip;
    const attachmentDrop = useComposerFileDrop({
        disabled: !canSendToRuntime,
        onFiles: addSelectedAttachments,
        target: 'main',
    });
    const handleSubmit = React.useEffectEvent((event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();

        if (!(agent && canSubmit)) {
            return;
        }

        const leadingTrimLength = prompt.length - prompt.trimStart().length;
        const submittedPrompt = prompt.trimStart();
        const submittedMentions = normalizeMentions(
            submittedPrompt,
            mentions.map((mention) => ({
                ...mention,
                end: mention.end - leadingTrimLength,
                start: mention.start - leadingTrimLength,
            }))
        );
        const submission = compileMentionSubmission(submittedPrompt, submittedMentions);
        const metadata = buildMentionMetadata(submission.mentions);
        const submittedAttachments = attachments;
        const submittedModelRef = modelRef ?? undefined;

        setPrompt('');
        setMentions([]);
        setAttachments([]);
        setAttachmentError(null);
        launchChatDraft({
            agentId: agent.id,
            ...(submittedAttachments.length ? { attachments: submittedAttachments } : {}),
            content: submission.content.trim(),
            metadata,
            ...(submittedModelRef ? { modelRef: submittedModelRef } : {}),
        });
    });
    const mentionComposer = useMentionComposer({
        agentId: canUseMentions && agent ? agent.id : '',
        agents: canUseMentions && agent ? [agent] : [],
        content: prompt,
        onTextChange: setPrompt,
        onSubmit: () => {
            void handleSubmit();
        },
        onMentionsChange: setMentions,
    });

    const isAgentDensity = density === 'agent';
    const promptId =
        id ?? (isAgentDensity ? `agent-${agent?.id ?? 'unknown'}-prompt` : 'home-prompt');
    const inputLabel = agent ? `Message ${agent.name}` : 'Start chat message';

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

    return (
        <PromptInput
            className={cn(isAgentDensity ? 'p-0' : 'mt-8 w-full p-0', className)}
            contentClassName="max-w-none"
            error={attachmentError}
            onSubmit={handleSubmit}
            onTextEditorFocus={canUseMentions ? mentionComposer.focusTextEditor : undefined}
        >
            <ChatComposerMainDropOverlay active={attachmentDrop.isFileDropActive} />
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
                {canUseMentions ? (
                    <MentionComposerEditor
                        ariaLabel={inputLabel}
                        autoFocus
                        composer={mentionComposer}
                        id={promptId}
                        name="start-chat"
                        placeholder={CHAT_COMPOSER_PLACEHOLDER}
                    />
                ) : (
                    <PromptInputTextarea
                        aria-label={inputLabel}
                        autoFocus
                        id={promptId}
                        name="start-chat"
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={(event) =>
                            handleChatComposerKeyDown({
                                event,
                                onSubmit: () => {
                                    handleSubmit();
                                },
                                onValueChange: setPrompt,
                                value: prompt,
                            })
                        }
                        placeholder={CHAT_COMPOSER_PLACEHOLDER}
                        rows={1}
                        value={prompt}
                    />
                )}
            </PromptInputBody>
            {canUseMentions ? <MentionComposerPicker composer={mentionComposer} /> : null}
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
                        disabled={!canSendToRuntime}
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <ModelSelectorSlot
                        disabled={!canSendToRuntime}
                        modelOptions={modelOptions}
                        modelRef={modelRef}
                        onModelChange={setModelRef}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    <PromptInputSubmit
                        canSubmit={canSubmit}
                        className={cn(isAgentDensity ? null : 'rounded-full')}
                        label="Start chat"
                        size="icon"
                        tooltip={getStartChatDisabledTooltip({
                            hasAgent: Boolean(agent),
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

function getStartChatDisabledTooltip({
    hasAgent,
    runtimeReady,
    runtimeReason,
}: {
    hasAgent: boolean;
    runtimeReady: boolean;
    runtimeReason: string;
}) {
    if (!hasAgent) {
        return runtimeUnhealthyTooltip;
    }

    if (!runtimeReady) {
        return runtimeReason;
    }

    return undefined;
}
