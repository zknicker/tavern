import { Cancel01Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { useChatThinkingDisplayPreference } from '../../hooks/chats/use-chat-thinking-display-preference.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { useActiveReplyLayoutSync } from './active-reply-layout-sync.tsx';
import { AgentPresenceIndicator } from './agent-presence-indicator.tsx';
import { CommandRunEntry } from './chat-command-card.tsx';
import { ChatInlineMarkdownText } from './chat-inline-markdown-text.tsx';
import {
    ChatTranscriptActivity,
    ChatTranscriptActivityGroup,
} from './chat-transcript-activity.tsx';
import {
    formatActiveActivitySeconds,
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
import {
    ChatTranscriptMessageAttachments,
    ChatTranscriptMessageContent,
} from './chat-transcript-message.tsx';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import { getItemSessionKey, isActivityBackedMessageRow } from './chat-transcript-model.ts';
import { RuntimeNoticeEntry } from './chat-transcript-system-step.tsx';
import { useChatScrollControllerHandle } from './use-chat-scroll-controller.ts';
import { useRevealedText } from './use-revealed-text.ts';

const rowClassName = 'relative w-full px-3 py-1.5';
const newTurnGapClassName = '';
const hoverGroupClassName = 'group';
const agentPresenceSize = 32;
const activePresenceVerbs = [
    'Adventuring',
    'Brewing',
    'Conjuring',
    'Scrying',
    'Questing',
    'Forging',
    'Enchanting',
    'Spellcasting',
    'Charting',
    'Delving',
    'Summoning',
    'Transmuting',
    'Wandering',
    'Wayfinding',
    'Alchemizing',
    'Incanting',
    'Rummaging',
    'Tinkering',
    'Polishing',
    'Deciphering',
    'Divining',
    'Kindling',
    'Gathering',
    'Mapping',
    'Exploring',
    'Crafting',
    'Channeling',
    'Weaving',
    'Unfurling',
    'Illuminating',
] as const;

export function TranscriptEntryView({
    activeReply,
    agentPresenceColor,
    animateMessages,
    chatId,
    conversationLayout,
    currentSessionKey,
    entry,
    failedTurn,
    followsRuntimeNotice,
    presenceRows,
    showAgentPresence,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    animateMessages: boolean;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    entry: TranscriptEntry;
    failedTurn?: ChatTurnFailure | null;
    followsRuntimeNotice?: boolean;
    presenceRows: TranscriptRow[];
    showAgentPresence: boolean;
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
        return (
            <UserTurn animateMessages={animateMessages} entry={entry} layout={conversationLayout} />
        );
    }

    return (
        <AgentTurn
            activeReply={activeReply}
            agentPresenceColor={agentPresenceColor ?? null}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            entry={entry}
            failedTurn={failedTurn ?? null}
            followsRuntimeNotice={Boolean(followsRuntimeNotice)}
            layout={conversationLayout}
            presenceRows={presenceRows}
            showPresence={showAgentPresence}
            turnStartedAt={turnStartedAt}
        />
    );
}

function UserTurn({
    animateMessages,
    entry,
    layout,
}: {
    animateMessages: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'You';
    const lastMessage = getLastMessage(entry.items);

    if (!layout.showHumanIdentity) {
        return (
            <div
                className={cn(rowClassName, 'flex flex-col items-end gap-1.5', newTurnGapClassName)}
            >
                {entry.items.map((item) => (
                    <UserTurnItem
                        animateEnter={animateMessages}
                        className="max-w-[min(42rem,78%)]"
                        item={item}
                        key={getTranscriptItemKey(item)}
                        showMeta={isMessageItem(item, lastMessage)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={cn(rowClassName, 'flex justify-end', newTurnGapClassName)}>
            <div className="grid max-w-[min(42rem,82%)] grid-cols-[minmax(0,1fr)_2rem] gap-x-2.5">
                <div className="relative min-w-0">
                    <div className="mb-1.5 min-w-0 truncate pr-4 text-right font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                        {displayName}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        {entry.items.map((item) => (
                            <UserTurnItem
                                animateEnter={animateMessages}
                                className="max-w-[100%]"
                                item={item}
                                key={getTranscriptItemKey(item)}
                                showMeta={isMessageItem(item, lastMessage)}
                            />
                        ))}
                    </div>
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
    agentPresenceColor,
    chatId,
    currentSessionKey,
    entry,
    failedTurn,
    followsRuntimeNotice,
    layout,
    presenceRows,
    showPresence,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentPresenceColor: string | null;
    chatId?: string;
    currentSessionKey?: string | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    failedTurn: ChatTurnFailure | null;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    presenceRows: TranscriptRow[];
    showPresence: boolean;
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
    const visibleSegments = segments.filter((segment) => !isActiveStatusSegment(segment));
    const turnActive = isActiveTurn(items, activeReply, lastMessage);
    const activityItems = items.filter(isActivityItem);
    // While live, anchor the active timer to the turn start so it does
    // not reset when the first tool activity lands. Completed turns keep the
    // eyes but no timing text.
    const workStart = turnActive
        ? (turnStartedAt ?? getActivityStart(activityItems) ?? entry.timestamp)
        : (getActivityStart(activityItems) ?? turnStartedAt ?? entry.timestamp);
    const presenceNow = usePresenceNow(turnActive, workStart);
    const presenceTimingLabel = turnActive
        ? getAgentPresenceTimingLabel({
              now: presenceNow,
              start: workStart,
              verb: getActivePresenceVerb(activeReply?.runId ?? entry.id),
          })
        : null;
    const presence = showPresence ? (
        <AgentPresenceIndicator
            activeReply={activeReply}
            className="translate-y-px"
            color={actorProfile?.primaryColor ?? agentPresenceColor}
            failedTurn={failedTurn}
            rows={presenceRows}
            size={agentPresenceSize}
        />
    ) : null;
    return (
        <div
            className={cn(
                rowClassName,
                showIdentity ? newTurnGapClassName : followsRuntimeNotice ? 'mt-0' : null
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
                <div className={cn(hoverGroupClassName, 'w-full min-w-0')}>
                    {showIdentity ? (
                        <div className="mb-1.5 min-w-0 truncate font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                            {displayName}
                        </div>
                    ) : null}
                    <div className="relative min-w-0">
                        <div className="flex min-w-0 flex-col gap-2">
                            {visibleSegments.map((segment, index) => (
                                <AgentTurnSegment
                                    chatId={chatId}
                                    currentSessionKey={currentSessionKey}
                                    key={segment.key}
                                    lastMessage={lastMessage}
                                    segment={segment}
                                    turnActive={turnActive && index === visibleSegments.length - 1}
                                    turnCompletedAt={turnCompletedAt}
                                    turnStartedAt={turnStartedAt}
                                />
                            ))}
                        </div>
                    </div>
                    {presence ? (
                        <AgentPresenceRow label={presenceTimingLabel} presence={presence} />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function AgentPresenceRow({
    label,
    presence,
}: {
    label: string | null;
    presence: React.ReactNode;
}) {
    return (
        <div className="mt-3 flex h-8 min-w-0 items-center gap-2 overflow-visible text-muted-foreground/65 text-sm leading-5">
            {presence}
            {label ? (
                <span className="thinking-indicator-text flex min-h-8 items-center truncate tabular-nums">
                    {label}
                </span>
            ) : null}
        </div>
    );
}

function AgentTurnSegment({
    chatId,
    currentSessionKey,
    lastMessage,
    segment,
    turnActive,
    turnCompletedAt,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    lastMessage: Extract<TranscriptRow, { kind: 'message' }>['message'] | null;
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
            lastMessage={lastMessage}
        />
    );
}

function isActiveStatusSegment(segment: AgentItemSegment) {
    return segment.kind === 'item' && segment.item.kind === 'activeStatus';
}

function getAgentPresenceTimingLabel({
    now,
    start,
    verb,
}: {
    now: number;
    start: string | null;
    verb: string;
}) {
    const activeSeconds = formatActiveActivitySeconds({ now, start });
    return activeSeconds ? `${verb} for ${activeSeconds}` : verb;
}

function getActivePresenceVerb(seed: string) {
    let hash = 0;

    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }

    return activePresenceVerbs[hash % activePresenceVerbs.length] ?? activePresenceVerbs[0];
}

function usePresenceNow(enabled: boolean, start: string | null) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const updateNow = () => setNow(Date.now());
        const startMs = start ? Date.parse(start) : Number.NaN;
        const elapsedMs = Number.isNaN(startMs) ? 0 : Math.max(0, Date.now() - startMs);
        const delayMs = Number.isNaN(startMs) ? 1000 : 1000 - (elapsedMs % 1000);
        let interval: number | undefined;

        updateNow();

        const timeout = window.setTimeout(
            () => {
                updateNow();
                interval = window.setInterval(updateNow, 1000);
            },
            Math.max(100, delayMs)
        );

        return () => {
            window.clearTimeout(timeout);

            if (interval !== undefined) {
                window.clearInterval(interval);
            }
        };
    }, [enabled, start]);

    return now;
}

function UserTurnItem({
    animateEnter,
    className,
    item,
    showMeta,
}: {
    animateEnter: boolean;
    className?: string;
    item: TranscriptItem;
    showMeta: boolean;
}) {
    if (item.kind !== 'row' || item.row.kind !== 'message') {
        return null;
    }

    const message = item.row.message;
    const attachments = (
        <ChatTranscriptMessageAttachments attachments={message.attachments ?? []} />
    );
    const body = <ChatTranscriptMessageContent message={message} textClassName="text-current" />;

    return body ? (
        <ChatMessage
            actions={showMeta ? <TranscriptMessageActions message={message} /> : null}
            animateEnter={animateEnter}
            attachments={attachments}
            className={className}
            from="user"
            time={showMeta ? formatShortTime(message.timestamp) : null}
        >
            {body}
        </ChatMessage>
    ) : null;
}

function AgentTurnItem({
    chatId,
    currentSessionKey,
    item,
    lastMessage,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    item: TranscriptItem;
    lastMessage: Extract<TranscriptRow, { kind: 'message' }>['message'] | null;
}) {
    if (item.kind === 'activeReply') {
        return <ActiveReplyText item={item} />;
    }

    if (item.kind === 'activeStatus') {
        return null;
    }

    if (isAssistantNarrationItem(item)) {
        return <AssistantNarrationText item={item} />;
    }

    if (item.kind === 'row' && item.row.kind === 'message') {
        const message = item.row.message;

        return (
            <ChatMessage
                actions={
                    message.id === lastMessage?.id ? (
                        <TranscriptMessageActions message={message} />
                    ) : null
                }
                animateEnter={false}
                attachments={
                    <ChatTranscriptMessageAttachments attachments={message.attachments ?? []} />
                }
                className="max-w-[100%]"
                from="assistant"
            >
                <ChatTranscriptMessageContent message={message} />
            </ChatMessage>
        );
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
        <div className="whitespace-pre-wrap break-words text-foreground text-sm">{text}</div>
    ) : null;
}

function ActiveReplyText({ item }: { item: Extract<TranscriptItem, { kind: 'activeReply' }> }) {
    const syncActiveReplyLayout = useActiveReplyLayoutSync();
    const scrollController = useChatScrollControllerHandle();
    const revealedText = useRevealedText(
        getActiveReplyDisplayText(item.reply.text ?? ''),
        !item.reply.completedAt
    );

    React.useLayoutEffect(() => {
        syncActiveReplyLayout?.();
        scrollController?.pinBottomIfFollowing();
    });

    return (
        <ChatMessage animateEnter={false} className="max-w-[100%]" from="assistant">
            <ChatInlineMarkdownText content={revealedText} />
        </ChatMessage>
    );
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

function isMessageItem(
    item: TranscriptItem,
    message: Extract<TranscriptRow, { kind: 'message' }>['message'] | null
) {
    return (
        message !== null &&
        item.kind === 'row' &&
        item.row.kind === 'message' &&
        item.row.message.id === message.id
    );
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
