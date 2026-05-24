import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { InspectCodeIcon } from '@hugeicons-pro/core-stroke-rounded';
import { AgentAvatar } from '@tavern/agent-avatars';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { getMessageSessionContext } from '../rows/message-context.ts';
import { MessageContextBadges } from '../rows/message-context-badges.tsx';
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
    groupAgentItems,
} from './chat-transcript-item-utils.ts';
import { ChatTranscriptMessageContent } from './chat-transcript-message.tsx';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import { getItemSessionKey } from './chat-transcript-model.ts';
import { ThinkingIndicator, TypingIndicator } from './thinking-indicator.tsx';
import { TurnWorkDisclosure } from './working-log.tsx';

const rowClassName = 'relative w-full px-3 pt-1.5 pb-4';
const newTurnGapClassName = 'mt-2.5';
const hoverGroupClassName = 'group';
const metadataGapClassName = 'pb-8';

export function TranscriptEntryView({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    entry,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    entry: TranscriptEntry;
    turnStartedAt?: string | null;
}) {
    if (entry.kind === 'system') {
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
    layout,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    currentSessionKey?: string | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
    turnStartedAt?: string | null;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const showIdentity = layout.showAgentIdentity;
    const lastMessage = getLastMessage(entry.items);
    const turnCompletedAt = lastMessage?.timestamp ?? null;
    const segments = groupAgentItems(entry.items);
    const turnActive = isActiveTurn(entry.items, activeReply, lastMessage);
    const activityItems = entry.items.filter(isActivityItem);
    const hasWorkHeader = activityItems.length > 0 || entry.items.some(isAssistantNarrationItem);
    const activityEnd = getActivityEnd(activityItems);
    const workStart = getActivityStart(activityItems) ?? turnStartedAt ?? entry.timestamp;
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

    return (
        <div className={cn(rowClassName, showIdentity ? newTurnGapClassName : 'mt-5')}>
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
                        'relative w-[min(80%,52rem)] min-w-0',
                        lastMessage && metadataGapClassName
                    )}
                >
                    {showIdentity ? (
                        <div className="mb-1.5 min-w-0 truncate font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                            {displayName}
                        </div>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-5">
                        {hasWorkHeader ? (
                            <TurnWorkDisclosure
                                end={workEnd}
                                start={workStart}
                                status={turnActive ? 'active' : 'completed'}
                            >
                                {workSegments.map((segment) => (
                                    <AgentTurnSegment
                                        chatId={chatId}
                                        currentSessionKey={currentSessionKey}
                                        key={segment.key}
                                        segment={segment}
                                        turnActive={turnActive}
                                        turnCompletedAt={turnCompletedAt}
                                        turnStartedAt={turnStartedAt}
                                    />
                                ))}
                            </TurnWorkDisclosure>
                        ) : null}
                        {(hasWorkHeader ? replySegments : segments).map((segment) => (
                            <AgentTurnSegment
                                chatId={chatId}
                                currentSessionKey={currentSessionKey}
                                key={segment.key}
                                segment={segment}
                                turnActive={turnActive}
                                turnCompletedAt={turnCompletedAt}
                                turnStartedAt={turnStartedAt}
                            />
                        ))}
                    </div>
                    {lastMessage ? (
                        <TranscriptHoverMeta includeContextBadges message={lastMessage} />
                    ) : null}
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
        <AgentTurnItem
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            item={segment.item}
        />
    );
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

function isReplyOutcomeItem(item: TranscriptItem) {
    return (
        item.kind === 'activeReply' ||
        item.kind === 'failure' ||
        (item.kind === 'row' && item.row.kind === 'message')
    );
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
        return item.status === 'thinking' ? (
            <ThinkingIndicator aria-label="Agent is thinking" className="-ml-3 text-sm" />
        ) : (
            <TypingIndicator aria-label="Agent is typing" className="-ml-3 text-sm" />
        );
    }

    if (isAssistantNarrationItem(item)) {
        return <AssistantNarrationText item={item} />;
    }

    if (item.kind === 'row' && item.row.kind === 'message') {
        return <ChatTranscriptMessageContent message={item.row.message} />;
    }

    if (item.kind === 'failure') {
        return <AgentTurnFailure item={item} />;
    }

    return (
        <ChatTranscriptActivity chatId={chatId} currentSessionKey={currentSessionKey} item={item} />
    );
}

function AssistantNarrationText({ item }: { item: TranscriptItem }) {
    const text = getAssistantNarrationText(item);

    return text ? (
        <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-[1.72]">
            {text}
        </div>
    ) : null;
}

function ActiveReplyText({ item }: { item: Extract<TranscriptItem, { kind: 'activeReply' }> }) {
    return (
        <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-[1.72]">
            {item.reply.text}
        </div>
    );
}

function AgentTurnFailure({ item }: { item: Extract<TranscriptItem, { kind: 'failure' }> }) {
    return (
        <Alert className="w-full max-w-[34rem]" variant="error">
            <Icon icon={AlertCircleIcon} />
            <AlertTitle>Agent turn failed</AlertTitle>
            <AlertDescription>{item.failure.error}</AlertDescription>
        </Alert>
    );
}

function TranscriptHoverMeta({
    align = 'left',
    includeContextBadges = false,
    message,
}: {
    align?: 'left' | 'right';
    includeContextBadges?: boolean;
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
            {includeContextBadges ? (
                <MessageContextBadges className="shrink-0" message={message} />
            ) : null}
        </div>
    );
}

function TranscriptMessageActions({
    message,
}: {
    message: Extract<TranscriptRow, { kind: 'message' }>['message'];
}) {
    const { openSession } = useSessionDrawer();
    const sessionContext = getMessageSessionContext(message);

    return (
        <>
            {sessionContext ? (
                <button
                    aria-label="View session"
                    className={messageActionButtonClassName}
                    onClick={() => openSession(sessionContext.sessionKey)}
                    title="View session"
                    type="button"
                >
                    <Icon className="size-3.5" icon={InspectCodeIcon} strokeWidth={2} />
                </button>
            ) : null}
            <CopyButton
                className={messageActionButtonClassName}
                copiedLabel="Copied message"
                label="Copy message"
                value={message.content}
            />
        </>
    );
}

const messageActionButtonClassName =
    'inline-flex size-5 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/75 shadow-none hover:bg-transparent hover:text-foreground';

function getLastMessage(items: TranscriptItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (item?.kind === 'row' && item.row.kind === 'message') {
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
    if (!(activeReply && lastMessage === null)) {
        return false;
    }

    return items.some((item) => getItemSessionKey(item) === activeReply.sessionKey);
}

function getTurnFallbackName(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    const message = getLastMessage(entry.items);
    return message?.sender ?? null;
}
