import * as React from 'react';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import {
    buildMentionMetadata,
    compileMentionSubmission,
    normalizeMentions,
} from '../mentions/mention-text.ts';
import type { Mention } from '../mentions/mention-types.ts';
import type { ChatContextFullness } from './chat-context-fullness.ts';
import {
    ChatMessageComposerSurface,
    type ChatMessageComposerVariant,
} from './chat-message-composer-surface.tsx';

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
    const [agentId, setAgentId] = React.useState<string>(boundAgentIds[0] ?? '');
    const [content, setContent] = React.useState('');
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const trimmedContent = content.trim();
    const canSend =
        chatCanSend &&
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
        <ChatMessageComposerSurface
            agentId={agentId}
            agents={agents}
            boundAgentIds={boundAgentIds}
            canSubmit={canSend}
            content={content}
            contextFullness={contextFullness}
            disabled={
                isDisabled || !chatCanSend || sendMessage.isPending || boundAgentIds.length === 0
            }
            error={sendMessage.error?.message}
            name="chat-message"
            onAgentChange={setAgentId}
            onMentionsChange={setMentions}
            onSubmit={handleSubmit}
            onTextChange={setContent}
            placeholder={getPlaceholder({
                agentRuntimeSyncLabel,
                boundAgentCount: boundAgentIds.length,
                canSend: chatCanSend,
                isDisabled,
                variant,
            })}
            variant={variant}
        />
    );
}

function getPlaceholder({
    agentRuntimeSyncLabel,
    boundAgentCount,
    canSend,
    isDisabled,
    variant,
}: {
    agentRuntimeSyncLabel: string | null;
    boundAgentCount: number;
    canSend: boolean;
    isDisabled: boolean;
    variant: ChatMessageComposerVariant;
}) {
    if (isDisabled) {
        return agentRuntimeSyncLabel ?? 'Chat is not ready for sending.';
    }

    if (!canSend) {
        return 'This chat does not have a synced session for sending.';
    }

    if (boundAgentCount === 0) {
        return 'Bind at least one agent to this chat.';
    }

    return variant === 'compact' ? 'Send a message to this chat...' : 'Ask for follow-up changes';
}
