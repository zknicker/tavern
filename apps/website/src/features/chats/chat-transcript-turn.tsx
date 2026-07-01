import { Cancel01Icon } from '@hugeicons/core-free-icons';
import type { AgentCharacter } from '@tavern/api/agent-appearance';
import { useReducedMotion } from 'framer-motion';
import type * as React from 'react';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Message,
    MessageAvatar,
    MessageContent,
    MessageHeader,
} from '../../components/ui/message.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import { isLocalTimelineMessageMetadata } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { AgentRichResponse } from '../../rich-responses/render-rich-response.tsx';
import { AgentFace, type HeadKind } from './agent-face.tsx';
import { CommandRunEntry } from './chat-command-card.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { useStreamingTextRanges } from './chat-streaming-text-ranges.ts';
import {
    ChatTranscriptActivity,
    ChatTranscriptActivityGroup,
} from './chat-transcript-activity.tsx';
import {
    getAssistantNarrationText,
    isAssistantNarrationItem,
} from './chat-transcript-activity-utils.ts';
import {
    type AgentItemSegment,
    getTranscriptItemKey,
    groupAgentItems,
} from './chat-transcript-item-utils.ts';
import {
    ChatTranscriptMessageContent,
    getTranscriptMessageContent,
    renderTranscriptMessageAttachments,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import { getItemSessionKey, isActivityBackedMessageRow } from './chat-transcript-model.ts';
import { RuntimeNoticeEntry } from './chat-transcript-system-step.tsx';
import { useRevealedText } from './use-revealed-text.ts';

// `group/turn` is the hover unit for a whole message: hovering the row reveals
// its actions (the copy button next to the timestamp, or above the owner's own
// bubble). Spacing is intentionally tight — the row's own `py` padding carries
// most of the room between messages, with only a small gap between scroller
// items (see chat-transcript.tsx).
const rowClassName = 'group/turn w-full py-1.5';
// Message actions stay hidden until the row is hovered or focused. No
// transition — the affordance tracks the pointer instantly.
const hoverActionsClassName =
    'flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover/turn:opacity-100';
const newTurnGapClassName = '';
// Pin the identity avatar to the top of the row. The shadcn MessageAvatar
// defaults to self-end and lifts by -translate-y-8 when the message has a
// footer; our roster layout keeps it aligned with the name header instead.
const turnAvatarBaseClassName =
    'size-8 min-w-8 self-start ring-1 ring-border/50 group-has-data-[slot=message-footer]/message:translate-y-0';
const hoverGroupClassName = 'group';

export function TranscriptEntryView({
    activeReply,
    agentStatusCharacter = null,
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    entry,
    followsRuntimeNotice,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusCharacter?: AgentCharacter | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    entry: TranscriptEntry;
    followsRuntimeNotice?: boolean;
    turnStartedAt?: string | null;
}) {
    if (entry.kind === 'system') {
        if (
            entry.item.kind === 'row' &&
            entry.item.row.kind === 'system' &&
            entry.item.row.systemKind === 'runtimeNotice'
        ) {
            return <RuntimeNoticeEntry row={entry.item.row} />;
        }

        if (
            entry.item.kind === 'row' &&
            entry.item.row.kind === 'system' &&
            entry.item.row.systemKind === 'commandRun'
        ) {
            return <CommandRunEntry chatId={chatId} row={entry.item.row} />;
        }

        return (
            <div className="mt-4 w-full px-3 py-2.5">
                <ChatTranscriptActivity
                    chatId={chatId}
                    currentSessionKey={currentSessionKey}
                    item={entry.item}
                />
            </div>
        );
    }

    if (entry.participant === 'user') {
        return <UserTurn entry={entry} layout={conversationLayout} />;
    }

    return (
        <AgentTurn
            activeReply={activeReply}
            agentStatusCharacter={agentStatusCharacter}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            entry={entry}
            followsRuntimeNotice={Boolean(followsRuntimeNotice)}
            layout={conversationLayout}
            turnStartedAt={turnStartedAt}
        />
    );
}

function UserTurn({
    entry,
    layout,
}: {
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'You';
    const lastMessage = getLastMessage(entry.items);
    // The app owner's own turn reads as a right-anchored, avatar-less bubble.
    // Other people in the chat use the same left roster as agents.
    const isSelf = actorProfile?.isSelf ?? false;

    if (isSelf) {
        return (
            <Message align="start" className={cn(rowClassName, newTurnGapClassName)}>
                <MessageContent className="pt-0.5">
                    {lastMessage ? (
                        <div className={cn(hoverActionsClassName, 'justify-end gap-2 pe-0.5')}>
                            <span className="min-w-0 truncate font-semibold text-foreground text-sm leading-5">
                                {displayName}
                            </span>
                            {entry.timestamp ? (
                                <time
                                    className="shrink-0 text-muted-foreground/65 text-xs tabular-nums"
                                    dateTime={entry.timestamp}
                                >
                                    {formatShortTime(entry.timestamp)}
                                </time>
                            ) : null}
                            <TranscriptMessageActions value={lastMessage.content} />
                        </div>
                    ) : null}
                    {entry.items.map((item) => (
                        <UserTurnItem from="user" item={item} key={getTranscriptItemKey(item)} />
                    ))}
                </MessageContent>
            </Message>
        );
    }

    return (
        <Message align="start" className={cn(rowClassName, newTurnGapClassName)}>
            <TurnAvatar
                actorKind={actorProfile?.kind ?? 'participant'}
                avatarUrl={actorProfile?.avatarUrl}
                color={actorProfile?.primaryColor}
                name={displayName}
            />
            <MessageContent className="gap-0.5 pt-0.5">
                {layout.showHumanIdentity ? (
                    <TurnHeader
                        actions={
                            lastMessage ? (
                                <TranscriptMessageActions value={lastMessage.content} />
                            ) : null
                        }
                        displayName={displayName}
                        timestamp={entry.timestamp}
                    />
                ) : null}
                <div className="flex min-w-0 flex-col gap-1.5">
                    {entry.items.map((item) => (
                        <UserTurnItem
                            from="assistant"
                            item={item}
                            key={getTranscriptItemKey(item)}
                        />
                    ))}
                </div>
            </MessageContent>
        </Message>
    );
}

function getActiveReplyText(items: TranscriptItem[]) {
    for (const item of items) {
        if (item.kind === 'activeReply') {
            return item.reply.text ?? '';
        }
    }

    return '';
}

function TurnAvatar({
    actorKind,
    avatarUrl,
    character = 'none',
    color,
    name,
}: {
    actorKind: 'agent' | 'participant' | 'profile';
    avatarUrl?: string | null;
    character?: HeadKind;
    color?: string | null;
    name: string;
}) {
    // Agents wear their character face as their identity avatar; people use an
    // uploaded image, falling back to initials.
    const variant = resolveTurnAvatarVariant(actorKind, avatarUrl);

    if (variant === 'eyes') {
        // The character face is its own shape — no avatar chrome behind it.
        return (
            <MessageAvatar
                className={cn(
                    turnAvatarBaseClassName,
                    'overflow-visible rounded-none bg-transparent ring-0'
                )}
            >
                <AgentFace
                    animated={false}
                    aria-hidden
                    className="overflow-visible"
                    head={character}
                    size={32}
                />
            </MessageAvatar>
        );
    }

    if (variant === 'image') {
        return (
            <MessageAvatar className={turnAvatarBaseClassName}>
                <img
                    alt={`${name} avatar`}
                    className="size-full object-cover"
                    height={32}
                    src={avatarUrl ?? undefined}
                    width={32}
                />
            </MessageAvatar>
        );
    }

    const style = color
        ? ({
              '--chat-avatar-color': color,
          } as React.CSSProperties)
        : undefined;

    return (
        <MessageAvatar
            className={cn(
                turnAvatarBaseClassName,
                'rounded-full font-semibold text-xs shadow-xs',
                color
                    ? 'bg-[var(--chat-avatar-color)] text-white'
                    : 'bg-muted text-muted-foreground'
            )}
            style={style}
        >
            {getActorInitials(name)}
        </MessageAvatar>
    );
}

function TurnHeader({
    actions,
    displayName,
    timestamp,
}: {
    actions?: React.ReactNode;
    displayName: string;
    timestamp: string | null;
}) {
    return (
        <MessageHeader className="gap-2 px-0">
            <span className="min-w-0 truncate font-semibold text-foreground text-sm leading-5">
                {displayName}
            </span>
            {timestamp ? (
                <time
                    className="shrink-0 text-muted-foreground/65 text-xs tabular-nums"
                    dateTime={timestamp}
                >
                    {formatShortTime(timestamp)}
                </time>
            ) : null}
            {actions ? <span className={hoverActionsClassName}>{actions}</span> : null}
        </MessageHeader>
    );
}

export function resolveTurnAvatarVariant(
    actorKind: 'agent' | 'participant' | 'profile',
    avatarUrl?: string | null
): 'eyes' | 'image' | 'initials' {
    if (actorKind === 'agent') {
        return 'eyes';
    }

    return avatarUrl ? 'image' : 'initials';
}

function getActorInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return '?';
    }

    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
    }

    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function AgentTurn({
    activeReply,
    agentStatusCharacter,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusCharacter: AgentCharacter | null;
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    turnStartedAt?: string | null;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const items = entry.items;
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const showIdentity = layout.showAgentIdentity;
    const lastMessage = getLastMessage(items);
    const turnCompletedAt = lastMessage?.timestamp ?? null;
    const segments = groupAgentItems(items);
    const visibleSegments = segments.filter((segment) => !isActiveStatusSegment(segment));
    const turnStopped =
        hasStoppedTurn(items, activeReply?.runId) || (!activeReply && hasAnyStoppedTurn(items));
    const turnActive = isActiveTurn(items, activeReply, lastMessage);
    const copyValue = lastMessage?.content ?? getActiveReplyText(items);
    const headerActions = lastMessage ? (
        <TranscriptMessageActions value={lastMessage.content} />
    ) : copyValue ? (
        <TranscriptMessageActions disabled value={copyValue} />
    ) : null;
    return (
        <Message
            align="start"
            className={cn(
                rowClassName,
                showIdentity ? newTurnGapClassName : followsRuntimeNotice ? 'mt-0' : null
            )}
        >
            <TurnAvatar
                actorKind="agent"
                character={actorProfile?.character ?? agentStatusCharacter ?? 'none'}
                name={displayName}
            />
            <MessageContent className="gap-0.5 pt-0.5">
                {showIdentity ? (
                    <TurnHeader
                        actions={headerActions}
                        displayName={displayName}
                        timestamp={entry.timestamp}
                    />
                ) : null}
                <div className={cn(hoverGroupClassName, 'relative min-w-0')}>
                    <div className="flex min-w-0 flex-col gap-3">
                        {visibleSegments.map((segment, index) => (
                            <AgentTurnSegment
                                chatId={chatId}
                                currentSessionKey={currentSessionKey}
                                defaultOpenWorkGroups={defaultOpenWorkGroups}
                                key={segment.key}
                                segment={segment}
                                turnActive={turnActive && index === visibleSegments.length - 1}
                                turnCompletedAt={turnCompletedAt}
                                turnStartedAt={turnStartedAt}
                                turnStopped={turnStopped}
                            />
                        ))}
                    </div>
                </div>
            </MessageContent>
        </Message>
    );
}

function AgentTurnSegment({
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    segment,
    turnActive,
    turnCompletedAt,
    turnStopped,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    segment: AgentItemSegment;
    turnActive: boolean;
    turnCompletedAt: string | null;
    turnStopped: boolean;
    turnStartedAt?: string | null;
}) {
    if (segment.kind === 'activity') {
        return (
            <ChatTranscriptActivityGroup
                chatId={chatId}
                currentSessionKey={currentSessionKey}
                defaultOpen={defaultOpenWorkGroups}
                items={segment.items}
                showDurationHeader={false}
                turnActive={turnActive}
                turnCompletedAt={turnCompletedAt}
                turnStartedAt={turnStartedAt}
                turnStopped={turnStopped}
            />
        );
    }

    return (
        <AgentTurnItem chatId={chatId} currentSessionKey={currentSessionKey} item={segment.item} />
    );
}

function isActiveStatusSegment(segment: AgentItemSegment) {
    return segment.kind === 'item' && segment.item.kind === 'activeStatus';
}

function UserTurnItem({ from, item }: { from: 'assistant' | 'user'; item: TranscriptItem }) {
    if (item.kind !== 'row' || item.row.kind !== 'message') {
        return null;
    }

    const message = item.row.message;
    const attachments = renderTranscriptMessageAttachments(message.attachments);
    const body = <ChatTranscriptMessageContent message={message} textClassName="text-current" />;

    return body ? (
        <ChatMessage
            animateEnter={isLocalTimelineMessageMetadata(message.metadata)}
            attachments={attachments}
            from={from}
        >
            {body}
        </ChatMessage>
    ) : null;
}

function AgentTurnItem({
    chatId,
    currentSessionKey,
    item,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    item: TranscriptItem;
}) {
    if (item.kind === 'activeReply') {
        return (
            <AssistantReplyText
                content={getActiveReplyDisplayText(item.reply.text ?? '')}
                revealKey={item.reply.runId}
                revealText={isStreamingActiveReply(item.reply)}
            />
        );
    }

    if (item.kind === 'activeStatus') {
        return null;
    }

    if (isAssistantNarrationItem(item)) {
        return <AssistantNarrationText item={item} />;
    }

    if (item.kind === 'row' && item.row.kind === 'message') {
        return <AssistantReplyText message={item.row.message} />;
    }

    if (item.kind === 'row' && item.row.kind === 'rich_response') {
        return <AgentRichResponse row={item.row} />;
    }

    if (item.kind === 'failure') {
        return <AgentTurnFailure chatId={chatId} item={item} />;
    }

    if (isTurnStatusItem(item)) {
        return <AgentTurnStatus item={item} />;
    }

    return (
        <ChatTranscriptActivity chatId={chatId} currentSessionKey={currentSessionKey} item={item} />
    );
}

function AssistantNarrationText({ item }: { item: TranscriptItem }) {
    const text = getAssistantNarrationText(item);

    return text ? (
        <div className="min-w-0 max-w-[46rem] whitespace-pre-wrap break-words text-foreground text-sm leading-6 [overflow-wrap:anywhere]">
            {text}
        </div>
    ) : null;
}

function AssistantReplyText({
    content,
    message,
    revealKey,
    revealText = false,
}: {
    content?: string;
    message?: TranscriptMessage;
    revealKey?: string;
    revealText?: boolean;
}) {
    const fullContent = content ?? (message ? getTranscriptMessageContent(message) : '');
    const revealedText = useRevealedText(fullContent, {
        enabled: revealText,
        revealKey: revealKey ?? (message ? getAssistantMessageRevealKey(message) : 'assistant'),
    });
    const shouldReduceMotion = useReducedMotion();
    const animatedRanges = useStreamingTextRanges(revealedText, {
        enabled:
            shouldReduceMotion !== true && (revealText || revealedText.length < fullContent.length),
    });
    const attachments = message ? renderTranscriptMessageAttachments(message.attachments) : null;

    return (
        <ChatMessage animateEnter={false} attachments={attachments} from="assistant">
            {message ? (
                <ChatTranscriptMessageContent
                    animatedRanges={animatedRanges}
                    contentOverride={revealedText}
                    message={message}
                />
            ) : (
                <ChatMarkdownText animatedRanges={animatedRanges} content={revealedText} />
            )}
        </ChatMessage>
    );
}

function getAssistantMessageRevealKey(message: TranscriptMessage) {
    const runtime = message.metadata?.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return message.id;
    }

    const runId = (runtime as Record<string, unknown>).runId;

    return typeof runId === 'string' && runId.trim().length > 0 ? runId : message.id;
}

function isStreamingActiveReply(reply: ChatActiveReply) {
    return !reply.completedAt;
}

export function getActiveReplyDisplayText(text: string) {
    return text.trimStart().trimEnd();
}

function AgentTurnFailure({
    chatId,
    item,
}: {
    chatId?: string;
    item: Extract<TranscriptItem, { kind: 'failure' }>;
}) {
    const { dismissRow } = useChatDismiss(chatId);
    const responseId = item.failure.responseId;

    return (
        <p className="group/failure max-w-[34rem] pl-0.5 text-sm leading-5" role="alert">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-error" />
            <span className="font-medium text-error-foreground">Response failed</span>
            <span className="text-muted-foreground"> · {item.failure.error}</span>
            {chatId && responseId ? (
                <button
                    aria-label="Dismiss failed response"
                    className={cn(
                        messageActionButtonClassName,
                        'ml-1 align-text-bottom opacity-0 group-hover/failure:opacity-100'
                    )}
                    onClick={() => dismissRow(responseId)}
                    title="Dismiss"
                    type="button"
                >
                    <Icon className="size-3.5" icon={Cancel01Icon} strokeWidth={2} />
                </button>
            ) : null}
        </p>
    );
}

function AgentTurnStatus({
    item,
}: {
    item: Extract<TranscriptItem, { kind: 'row' }> & {
        row: Extract<TranscriptRow, { kind: 'system'; systemKind: 'turnStatus' }>;
    };
}) {
    return (
        <p className="max-w-[34rem] pl-0.5 text-sm leading-5">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-error" />
            <span className="font-medium text-muted-foreground">{item.row.turnStatus.text}</span>
        </p>
    );
}

function isTurnStatusItem(item: TranscriptItem): item is Extract<
    TranscriptItem,
    { kind: 'row' }
> & {
    row: Extract<TranscriptRow, { kind: 'system'; systemKind: 'turnStatus' }>;
} {
    return (
        item.kind === 'row' && item.row.kind === 'system' && item.row.systemKind === 'turnStatus'
    );
}

function TranscriptMessageActions({
    disabled = false,
    value,
}: {
    disabled?: boolean;
    value: string;
}) {
    return (
        <CopyButton
            className={messageActionButtonClassName}
            copiedLabel="Copied message"
            disabled={disabled}
            label={disabled ? 'Copy available when complete' : 'Copy message'}
            value={value}
        />
    );
}

const messageActionButtonClassName =
    'inline-flex size-5 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/75 shadow-none hover:bg-transparent hover:text-foreground';

function getLastMessage(items: TranscriptItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (
            item?.kind === 'row' &&
            item.row.kind === 'message' &&
            !isActivityBackedMessageRow(item.row)
        ) {
            return item.row.message;
        }
    }

    return null;
}

function isActiveTurn(
    items: TranscriptItem[],
    activeReply: ChatActiveReply | null,
    lastMessage: Extract<TranscriptRow, { kind: 'message' }>['message'] | null
) {
    if (
        !(activeReply && lastMessage === null) ||
        activeReply.completedAt ||
        hasStoppedTurn(items, activeReply.runId)
    ) {
        return false;
    }

    return items.some((item) => getItemSessionKey(item) === activeReply.sessionKey);
}

function hasStoppedTurn(items: TranscriptItem[], runId: string | null | undefined) {
    return Boolean(
        runId &&
            items.some(
                (item) =>
                    item.kind === 'row' &&
                    item.row.kind === 'system' &&
                    item.row.systemKind === 'turnStatus' &&
                    item.row.turnStatus.runId === runId
            )
    );
}

function hasAnyStoppedTurn(items: TranscriptItem[]) {
    return items.some(
        (item) =>
            item.kind === 'row' &&
            item.row.kind === 'system' &&
            item.row.systemKind === 'turnStatus'
    );
}

function getTurnFallbackName(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    const message = getLastMessage(entry.items);
    return message?.sender ?? null;
}
