import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { useChatThinkingDisplayPreference } from '../../hooks/chats/use-chat-thinking-display-preference.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { CommandRunEntry } from './chat-command-card.tsx';
import { ChatInlineMarkdownText } from './chat-inline-markdown-text.tsx';
import {
    ChatTranscriptActivity,
    ChatTranscriptActivityGroup,
} from './chat-transcript-activity.tsx';
import {
    getActivityEnd,
    getActivityStart,
    getAssistantNarrationText,
    isActivityItem,
    isAssistantNarrationItem,
} from './chat-transcript-activity-utils.ts';
import {
    type AgentItemSegment,
    getTranscriptItemKey,
    getVisibleAgentItems,
    groupAgentItems,
} from './chat-transcript-item-utils.ts';
import { ChatTranscriptMessageContent } from './chat-transcript-message.tsx';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import { getItemSessionKey, isActivityBackedMessageRow } from './chat-transcript-model.ts';
import { RuntimeNoticeEntry } from './chat-transcript-system-step.tsx';
import { ThinkingIndicator } from './thinking-indicator.tsx';
import { useRevealedText } from './use-revealed-text.ts';
import { TurnWorkDisclosure } from './working-log.tsx';

const rowClassName = 'relative w-full px-3 pt-1 pb-3';
const newTurnGapClassName = 'mt-1.5';
const hoverGroupClassName = 'group';
const metadataGapClassName = 'pb-6';

export function TranscriptEntryView({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    entry,
    followsRuntimeNotice,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
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
            chatId={chatId}
            currentSessionKey={currentSessionKey}
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

    if (!layout.showHumanIdentity) {
        return (
            <div className={cn(rowClassName, 'flex justify-end', newTurnGapClassName)}>
                <div
                    className={cn(
                        hoverGroupClassName,
                        'relative flex max-w-[min(42rem,78%)] flex-col items-end gap-1.5',
                        lastMessage && metadataGapClassName
                    )}
                >
                    {entry.items.map((item) => (
                        <UserTurnItem item={item} key={getTranscriptItemKey(item)} />
                    ))}
                    {lastMessage ? (
                        <TranscriptHoverMeta align="right" message={lastMessage} />
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={cn(rowClassName, 'flex justify-end', newTurnGapClassName)}>
            <div className="grid max-w-[min(42rem,82%)] grid-cols-[minmax(0,1fr)_2rem] gap-x-2.5">
                <div
                    className={cn(
                        hoverGroupClassName,
                        'relative min-w-0',
                        lastMessage && metadataGapClassName
                    )}
                >
                    <div className="mb-1.5 min-w-0 truncate pr-4 text-right font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                        {displayName}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        {entry.items.map((item) => (
                            <UserTurnItem item={item} key={getTranscriptItemKey(item)} />
                        ))}
                    </div>
                    {lastMessage ? (
                        <TranscriptHoverMeta align="right" message={lastMessage} />
                    ) : null}
                </div>
                <div className="flex justify-center pt-5">
                    <AgentAvatar
                        avatar={actorProfile?.avatar ?? displayName}
                        backgroundColor={actorProfile?.primaryColor ?? '#64748b'}
                        className="size-6 shrink-0"
                        name={displayName}
                    />
                </div>
            </div>
        </div>
    );
}

function AgentTurn({
    activeReply,
    chatId,
    currentSessionKey,
    entry,
    followsRuntimeNotice,
    layout,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    currentSessionKey?: string | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    turnStartedAt?: string | null;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const chatThinkingDisplay = useChatThinkingDisplayPreference();
    const items = getVisibleAgentItems({
        items: entry.items,
        showThinkingText: chatThinkingDisplay.enabled,
    });
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const showIdentity = layout.showAgentIdentity;
    const lastMessage = getLastMessage(items);
    const turnCompletedAt = lastMessage?.timestamp ?? null;
    const segments = groupAgentItems(items);
    const turnActive = isActiveTurn(items, activeReply, lastMessage);
    const activityItems = items.filter(isActivityItem);
    const hasWorkHeader =
        activityItems.length > 0 ||
        items.some((item) => isAssistantNarrationItem(item) || isNarrationMessageItem(item));
    const activityEnd = getActivityEnd(activityItems);
    // While live, anchor the "Working for" timer to the turn start so it does
    // not reset when the first tool activity lands. Completed turns keep the
    // durable activity span.
    const workStart = turnActive
        ? (turnStartedAt ?? getActivityStart(activityItems) ?? entry.timestamp)
        : (getActivityStart(activityItems) ?? turnStartedAt ?? entry.timestamp);
    const workEnd = turnActive
        ? null
        : activityEnd
          ? (turnCompletedAt ?? activityEnd)
          : (turnCompletedAt ?? entry.timestamp);
    const finalSegmentIndex = findFinalSegmentIndex(segments);
    const workSegments =
        hasWorkHeader && finalSegmentIndex >= 0
            ? segments.filter((_, index) => index !== finalSegmentIndex)
            : segments;
    const replySegments =
        hasWorkHeader && finalSegmentIndex >= 0 ? [segments[finalSegmentIndex]] : [];
    const activeReplyStarted =
        turnActive &&
        activeReply !== null &&
        items.some(
            (item) =>
                item.kind === 'activeReply' &&
                item.reply.runId === activeReply.runId &&
                (item.reply.text ?? '').trim().length > 0
        );

    return (
        <div
            className={cn(
                rowClassName,
                showIdentity ? newTurnGapClassName : followsRuntimeNotice ? 'mt-0' : 'mt-3.5'
            )}
        >
            <div
                className={cn(
                    showIdentity ? 'grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2.5' : 'block'
                )}
            >
                {showIdentity ? (
                    <div className="flex justify-center pt-5">
                        <AgentAvatar
                            avatar={actorProfile?.avatar ?? displayName}
                            backgroundColor={actorProfile?.primaryColor ?? '#64748b'}
                            className="size-6 shrink-0"
                            name={displayName}
                        />
                    </div>
                ) : null}
                <div
                    className={cn(
                        hoverGroupClassName,
                        'relative w-full min-w-0',
                        // Reserved while live so the gap's appearance with the
                        // first durable message never resizes the turn — a
                        // tail shrink shifts the bottom-pinned chat.
                        (turnActive || lastMessage) && metadataGapClassName
                    )}
                >
                    {showIdentity ? (
                        <div className="mb-1.5 min-w-0 truncate font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                            {displayName}
                        </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-4">
                        {hasWorkHeader ? (
                            <TurnWorkDisclosure
                                collapseForReply={activeReplyStarted}
                                end={workEnd}
                                start={workStart}
                                status={turnActive ? 'active' : 'completed'}
                            >
                                {workSegments.map((segment, index) => (
                                    <AgentTurnSegment
                                        chatId={chatId}
                                        currentSessionKey={currentSessionKey}
                                        key={segment.key}
                                        segment={segment}
                                        turnActive={turnActive && index === workSegments.length - 1}
                                        turnCompletedAt={turnCompletedAt}
                                        turnStartedAt={turnStartedAt}
                                    />
                                ))}
                            </TurnWorkDisclosure>
                        ) : null}
                        {(hasWorkHeader ? replySegments : segments).map((segment) =>
                            // The status indicator narrates the work above
                            // it, so it sits at the work log's step rhythm
                            // instead of the reply slot's section gap. -0.5
                            // keeps the icon where the old padded indicator
                            // drew it now that the box is one text line tall.
                            hasWorkHeader && isActiveStatusSegment(segment) ? (
                                <div className="-mt-0.5" key={segment.key}>
                                    <AgentTurnSegment
                                        chatId={chatId}
                                        currentSessionKey={currentSessionKey}
                                        segment={segment}
                                        turnActive={turnActive}
                                        turnCompletedAt={turnCompletedAt}
                                        turnStartedAt={turnStartedAt}
                                    />
                                </div>
                            ) : (
                                <AgentTurnSegment
                                    chatId={chatId}
                                    currentSessionKey={currentSessionKey}
                                    key={segment.key}
                                    segment={segment}
                                    turnActive={turnActive}
                                    turnCompletedAt={turnCompletedAt}
                                    turnStartedAt={turnStartedAt}
                                />
                            )
                        )}
                    </div>
                    {lastMessage ? <TranscriptHoverMeta message={lastMessage} /> : null}
                </div>
            </div>
        </div>
    );
}

function AgentTurnSegment({
    chatId,
    currentSessionKey,
    segment,
    turnActive,
    turnCompletedAt,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    segment: AgentItemSegment;
    turnActive: boolean;
    turnCompletedAt: string | null;
    turnStartedAt?: string | null;
}) {
    return segment.kind === 'activity' ? (
        <ChatTranscriptActivityGroup
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            items={segment.items}
            showDurationHeader={false}
            turnActive={turnActive}
            turnCompletedAt={turnCompletedAt}
            turnStartedAt={turnStartedAt}
        />
    ) : (
        <AgentTurnItem chatId={chatId} currentSessionKey={currentSessionKey} item={segment.item} />
    );
}

function isActiveStatusSegment(segment: AgentItemSegment) {
    return segment.kind === 'item' && segment.item.kind === 'activeStatus';
}

function findFinalSegmentIndex(segments: AgentItemSegment[]) {
    for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segment = segments[index];

        if (segment.kind === 'item' && isReplyOutcomeItem(segment.item)) {
            return index;
        }
    }

    return -1;
}

// Narration messages are work-log evidence; only the live tail (status
// indicator or streaming text) and the durable reply may occupy the reply
// slot below the work disclosure. Keeping the indicator in the same slot the
// text streams into means the tail never vacates a row inside the work log.
function isReplyOutcomeItem(item: TranscriptItem) {
    return (
        item.kind === 'activeReply' ||
        item.kind === 'activeStatus' ||
        item.kind === 'failure' ||
        (item.kind === 'row' &&
            item.row.kind === 'message' &&
            !isActivityBackedMessageRow(item.row))
    );
}

function isNarrationMessageItem(item: TranscriptItem) {
    return item.kind === 'row' && isActivityBackedMessageRow(item.row);
}

function UserTurnItem({ item }: { item: TranscriptItem }) {
    if (item.kind !== 'row' || item.row.kind !== 'message') {
        return null;
    }

    const body = <ChatTranscriptMessageContent message={item.row.message} />;

    return body ? (
        <div className="rounded-[1.35rem] bg-muted px-4 py-2 text-foreground text-sm leading-snug">
            {body}
        </div>
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
        return <ActiveReplyText item={item} />;
    }

    if (item.kind === 'activeStatus') {
        // The indicator's internal px-3 minus this margin lands its icon on
        // the work log's px-2 icon grid, so the tail lines up with the rows
        // it follows.
        return <ThinkingIndicator aria-label="Agent is thinking" className="-ml-1 text-sm" />;
    }

    if (isAssistantNarrationItem(item)) {
        return <AssistantNarrationText item={item} />;
    }

    if (item.kind === 'row' && item.row.kind === 'message') {
        return <ChatTranscriptMessageContent message={item.row.message} />;
    }

    if (item.kind === 'failure') {
        return <AgentTurnFailure chatId={chatId} item={item} />;
    }

    return (
        <ChatTranscriptActivity chatId={chatId} currentSessionKey={currentSessionKey} item={item} />
    );
}

function AssistantNarrationText({ item }: { item: TranscriptItem }) {
    const text = getAssistantNarrationText(item);

    return text ? (
        <div className="whitespace-pre-wrap break-words text-foreground text-sm">{text}</div>
    ) : null;
}

function ActiveReplyText({ item }: { item: Extract<TranscriptItem, { kind: 'activeReply' }> }) {
    const revealedText = useRevealedText(
        (item.reply.text ?? '').trimStart(),
        !item.reply.completedAt
    );

    return (
        <div className="whitespace-pre-wrap break-words text-foreground text-sm">
            <ChatInlineMarkdownText content={revealedText} />
        </div>
    );
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
        <p className="group/failure max-w-[34rem] text-sm leading-5" role="alert">
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-error" />
            <span className="font-medium text-error-foreground">Response failed</span>
            <span className="text-muted-foreground"> · {item.failure.error}</span>
            {chatId && responseId ? (
                <button
                    aria-label="Dismiss failed response"
                    className={cn(
                        messageActionButtonClassName,
                        'ml-1 align-text-bottom opacity-0 transition-opacity duration-150 group-hover/failure:opacity-100'
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

function TranscriptHoverMeta({
    align = 'left',
    message,
}: {
    align?: 'left' | 'right';
    message: Extract<TranscriptRow, { kind: 'message' }>['message'];
}) {
    const actions = <TranscriptMessageActions message={message} />;

    return (
        <div
            className={cn(
                'pointer-events-none absolute bottom-0 z-10 flex h-5 items-center gap-2 whitespace-nowrap text-muted-foreground/75 text-xs leading-4 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100',
                align === 'right' ? 'right-0 justify-end' : 'left-0'
            )}
        >
            <span className="tabular-nums">{formatShortTime(message.timestamp)}</span>
            {actions}
        </div>
    );
}

function TranscriptMessageActions({
    message,
}: {
    message: Extract<TranscriptRow, { kind: 'message' }>['message'];
}) {
    return (
        <CopyButton
            className={messageActionButtonClassName}
            copiedLabel="Copied message"
            label="Copy message"
            value={message.content}
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
    if (!(activeReply && lastMessage === null) || activeReply.completedAt) {
        return false;
    }

    return items.some((item) => getItemSessionKey(item) === activeReply.sessionKey);
}

function getTurnFallbackName(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    const message = getLastMessage(entry.items);
    return message?.sender ?? null;
}
