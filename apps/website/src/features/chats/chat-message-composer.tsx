import * as React from 'react';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import { useCapability } from '../../hooks/connections/use-capability.ts';
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
import { ChatComposerAgentSelector, ChatComposerContextFullness } from './chat-composer-tools.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export type ChatMessageComposerVariant = 'compact' | 'detail';
const runtimeDisconnectedTooltip = 'Tavern Runtime is disconnected.';

export function ChatMessageComposer({
    agentRuntimeSyncLabel = null,
    agents,
    boundAgentIds,
    canSend: chatCanSend,
    chatId,
    contextFullness = null,
    isDisabled,
    variant = 'detail',
}: {
    agentRuntimeSyncLabel?: string | null;
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
    const gatewayCapability = useCapability('gateway');
    const messagesCapability = useCapability('messages');
    const [agentId, setAgentId] = React.useState<string>(boundAgentIds[0] ?? '');
    const [content, setContent] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const isCompact = variant === 'compact';
    const trimmedContent = content.trim();
    const canSendToRuntime = gatewayCapability.healthy && messagesCapability.healthy;
    const runtimeDisabledReason = runtimeDisconnectedTooltip;
    const canSend =
        chatCanSend &&
        canSendToRuntime &&
        !isDisabled &&
        !sendMessage.isPending &&
        agentId.length > 0 &&
        trimmedContent.length > 0;

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

        if (!canSend) {
            return;
        }

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
        setContent('');
        setMentions([]);

        await sendMessage.mutateAsync({
            agentId,
            chatId,
            clientMessageId: `msg_${crypto.randomUUID()}`,
            content: submission.content.trim(),
            metadata,
        });
    }

    return (
        <PromptInput
            className={cn(
                isCompact
                    ? 'border-t border-r-[3px] border-r-border/70 bg-chrome/40 px-3 py-3'
                    : null
            )}
            contentClassName={isCompact ? 'max-w-none' : undefined}
            error={sendMessage.error?.message}
            onSubmit={handleSubmit}
            onTextEditorFocus={mentionComposer.focusTextEditor}
            surfaceClassName={isCompact ? 'rounded-2xl shadow-none' : undefined}
        >
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
                    <ChatComposerAgentSelector
                        agentId={agentId}
                        agents={agents}
                        boundAgentIds={boundAgentIds}
                        onAgentChange={setAgentId}
                    />
                </PromptInputTools>
                <PromptInputActions>
                    {contextFullness ? (
                        <ChatComposerContextFullness fullness={contextFullness} />
                    ) : null}
                    <PromptInputSubmit
                        canSubmit={canSend}
                        label="Send message"
                        tooltip={getSendDisabledTooltip({
                            agentRuntimeSyncLabel,
                            boundAgentCount: boundAgentIds.length,
                            canSend: chatCanSend,
                            isDisabled,
                            isPending: sendMessage.isPending,
                            runtimeReady: canSendToRuntime,
                            runtimeReason: runtimeDisabledReason,
                        })}
                    />
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
}

function getSendDisabledTooltip({
    agentRuntimeSyncLabel,
    boundAgentCount,
    canSend,
    isDisabled,
    isPending,
    runtimeReady,
    runtimeReason,
}: {
    agentRuntimeSyncLabel: string | null;
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
