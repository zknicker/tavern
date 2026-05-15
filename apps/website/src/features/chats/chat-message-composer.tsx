import * as React from 'react';
import { useChatSend } from '../../hooks/chats/use-chat-send.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import {
    buildToolMentionMetadata,
    normalizeToolMentions,
} from '../tool-mentions/tool-mention-text.ts';
import type { ToolMention } from '../tool-mentions/tool-mention-types.ts';
import { handleChatComposerKeyDown } from './chat-composer-keyboard.ts';
import type { ChatContextFullness } from './chat-context-fullness.ts';
import type { ChatListItem } from './chat-list-data.ts';
import {
    ChatMessageComposerSurface,
    type ChatMessageComposerVariant,
} from './chat-message-composer-surface.tsx';

export function ChatMessageComposer({
    agents,
    chat,
    contextFullness = null,
    isReplyActive,
    variant = 'detail',
}: {
    agents: AgentListOutput['agents'];
    chat: ChatListItem;
    contextFullness?: ChatContextFullness | null;
    isReplyActive: boolean;
    variant?: ChatMessageComposerVariant;
}) {
    const sendMessage = useChatSend();
    const boundAgentIds = React.useMemo(() => chat.boundAgentIds, [chat.boundAgentIds]);
    const [agentId, setAgentId] = React.useState<string>(boundAgentIds[0] ?? '');
    const [content, setContent] = React.useState('');
    const [toolMentions, setToolMentions] = React.useState<ToolMention[]>([]);
    const trimmedContent = content.trim();
    const canSend =
        chat.canSend &&
        !chat.isDisabled &&
        !isReplyActive &&
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
        const submittedContent = trimmedContent;
        const submittedMentions = normalizeToolMentions(
            submittedContent,
            toolMentions.map((mention) => ({
                ...mention,
                end: mention.end - leadingTrimLength,
                start: mention.start - leadingTrimLength,
            }))
        );
        const metadata = buildToolMentionMetadata(submittedMentions);
        setContent('');
        setToolMentions([]);

        await sendMessage.mutateAsync({
            agentId,
            chatId: chat.id,
            clientMessageId: `tavern-message:${crypto.randomUUID()}`,
            content: submittedContent,
            metadata,
        });
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        handleChatComposerKeyDown({
            event,
            onSubmit: () => {
                void handleSubmit();
            },
            onValueChange: setContent,
            value: content,
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
                chat.isDisabled ||
                !chat.canSend ||
                isReplyActive ||
                sendMessage.isPending ||
                boundAgentIds.length === 0
            }
            error={sendMessage.error?.message}
            name="chat-message"
            onAgentChange={setAgentId}
            onSubmit={handleSubmit}
            onTextChange={setContent}
            onTextKeyDown={handleKeyDown}
            onToolMentionsChange={setToolMentions}
            placeholder={getPlaceholder({
                agentRuntimeSyncLabel: chat.agentRuntimeSyncLabel,
                boundAgentCount: boundAgentIds.length,
                canSend: chat.canSend,
                isDisabled: chat.isDisabled,
                isReplyActive,
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
    isReplyActive,
    variant,
}: {
    agentRuntimeSyncLabel: string | null;
    boundAgentCount: number;
    canSend: boolean;
    isDisabled: boolean;
    isReplyActive: boolean;
    variant: ChatMessageComposerVariant;
}) {
    if (isDisabled) {
        return agentRuntimeSyncLabel ?? 'Chat is not ready for sending.';
    }

    if (!canSend) {
        return 'This chat does not have a synced session for sending.';
    }

    if (isReplyActive) {
        return 'A reply is already in progress for this chat.';
    }

    if (boundAgentCount === 0) {
        return 'Bind at least one agent to this chat.';
    }

    return variant === 'compact' ? 'Send a message to this chat...' : 'Ask for follow-up changes';
}
