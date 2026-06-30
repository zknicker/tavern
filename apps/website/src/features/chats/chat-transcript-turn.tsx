import { Cancel01Icon } from '@hugeicons/core-free-icons';
import {
    AnimatePresence,
    motion,
    type Transition,
    useAnimationControls,
    useReducedMotion,
} from 'framer-motion';
import * as React from 'react';
import { chromatic } from 'slot-text';
import { SlotText } from 'slot-text/react';
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
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { formatShortTime } from '../../lib/format.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { AgentRichResponse } from '../../rich-responses/render-rich-response.tsx';
import { AgentEyes } from './agent-eyes.tsx';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';
import { getActivePresenceVerb } from './chat-active-presence-verb.ts';
import { CommandRunEntry } from './chat-command-card.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { useStreamingTextRanges } from './chat-streaming-text-ranges.ts';
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
const rowClassName = 'group/turn w-full px-3 py-1.5';
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
const agentStatusSize = 32;
const presenceLabelExitTransition = {
    duration: 0.12,
    ease: [0.4, 0, 0.2, 1],
} satisfies Transition;
const presenceBlockEnterTransition = {
    duration: 0.68,
    ease: [0.16, 1, 0.3, 1],
} satisfies Transition;
const reducedPresenceLabelTransition = { duration: 0.08 } satisfies Transition;

export function TranscriptEntryView({
    activeReply,
    activePresenceVerb = null,
    agentStatusColor = null,
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    entry,
    failedTurn = null,
    followsRuntimeNotice,
    presenceRows = [],
    showPresence = false,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb?: string | null;
    agentStatusColor?: string | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    entry: TranscriptEntry;
    failedTurn?: ChatTurnFailure | null;
    followsRuntimeNotice?: boolean;
    presenceRows?: TranscriptRow[];
    showPresence?: boolean;
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
            activePresenceVerb={activePresenceVerb}
            activeReply={activeReply}
            agentStatusColor={agentStatusColor}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            entry={entry}
            failedTurn={failedTurn}
            followsRuntimeNotice={Boolean(followsRuntimeNotice)}
            layout={conversationLayout}
            presenceRows={presenceRows}
            showPresence={showPresence}
            turnStartedAt={turnStartedAt}
        />
    );
}

function AgentStatusBlock({
    activeReply,
    activePresenceVerb,
    agentStatusColor,
    entry,
    failedTurn,
    presenceRows,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb?: string | null;
    agentStatusColor: string | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    failedTurn: ChatTurnFailure | null;
    presenceRows: TranscriptRow[];
    turnStartedAt?: string | null;
}) {
    const actorProfile = useActorProfile(entry.actor);
    const items = entry.items;
    const lastMessage = getLastMessage(items);
    const activeRunStopped = hasStoppedTurn(items, activeReply?.runId);
    const presenceActiveReply = activeRunStopped ? null : activeReply;
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
        ? getAgentStatusTimingLabel({
              now: presenceNow,
              start: workStart,
              verb: activePresenceVerb ?? getActivePresenceVerb(activeReply?.runId ?? entry.id),
          })
        : null;
    return (
        <AgentStatusRow
            label={presenceTimingLabel}
            presence={
                <AgentStatusIndicator
                    activeReply={presenceActiveReply}
                    className="translate-y-px"
                    color={actorProfile?.primaryColor ?? agentStatusColor}
                    failedTurn={failedTurn}
                    rows={presenceRows}
                    size={agentStatusSize}
                />
            }
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
            <MessageContent className="gap-1.5 pt-0.5">
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
    color,
    name,
}: {
    actorKind: 'agent' | 'participant' | 'profile';
    avatarUrl?: string | null;
    color?: string | null;
    name: string;
}) {
    // Agents wear the Tavern eyes as their identity avatar; people use an
    // uploaded image, falling back to initials.
    const variant = resolveTurnAvatarVariant(actorKind, avatarUrl);

    if (variant === 'eyes') {
        return (
            <MessageAvatar className={cn(turnAvatarBaseClassName, 'bg-muted')}>
                <AgentEyes
                    animated={false}
                    aria-hidden
                    className="overflow-visible"
                    color={color ?? 'var(--muted-foreground)'}
                    size={20}
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
    activePresenceVerb,
    agentStatusColor,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    failedTurn,
    followsRuntimeNotice,
    layout,
    presenceRows,
    showPresence,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb: string | null;
    agentStatusColor: string | null;
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    failedTurn: ChatTurnFailure | null;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    presenceRows: TranscriptRow[];
    showPresence: boolean;
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
                color={actorProfile?.primaryColor ?? agentStatusColor}
                name={displayName}
            />
            <MessageContent className="gap-1.5 pt-0.5">
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
                        {showPresence ? (
                            <AgentStatusBlock
                                activePresenceVerb={activePresenceVerb}
                                activeReply={activeReply}
                                agentStatusColor={agentStatusColor}
                                entry={entry}
                                failedTurn={failedTurn}
                                presenceRows={presenceRows}
                                turnStartedAt={turnStartedAt}
                            />
                        ) : null}
                    </div>
                </div>
            </MessageContent>
        </Message>
    );
}

function AgentStatusRow({
    label,
    presence,
}: {
    label: PresenceTimingLabel | null;
    presence: React.ReactNode;
}) {
    const shouldReduceMotion = useReducedMotion();
    const active = label !== null;
    const blockControls = useAnimationControls();
    const blockMountedRef = React.useRef(false);
    const previousActiveRef = React.useRef(false);
    const blockInitial = active && shouldReduceMotion !== true ? { opacity: 0, y: 22 } : false;
    const labelInitial = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0, x: -4 };
    const labelAnimate = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, width: 'auto', x: 0 };
    const labelExit = shouldReduceMotion
        ? { opacity: 0, transition: reducedPresenceLabelTransition }
        : {
              opacity: 0,
              transition: presenceLabelExitTransition,
              width: 0,
              x: -4,
          };
    const labelTransition = shouldReduceMotion ? reducedPresenceLabelTransition : springs.moderate;
    const labelText = label ? formatPresenceTimingLabel(label) : null;

    React.useLayoutEffect(() => {
        const wasActive = blockMountedRef.current ? previousActiveRef.current : false;
        blockMountedRef.current = true;
        previousActiveRef.current = active;

        if (shouldReduceMotion) {
            blockControls.set({ opacity: 1, y: 0 });
            return;
        }

        if (active && !wasActive) {
            blockControls.set({ opacity: 0, y: 22 });

            const frame = window.requestAnimationFrame(() => {
                void blockControls.start({
                    opacity: 1,
                    transition: presenceBlockEnterTransition,
                    y: 0,
                });
            });

            return () => window.cancelAnimationFrame(frame);
        }

        blockControls.set({ opacity: 1, y: 0 });
    }, [active, blockControls, shouldReduceMotion]);

    return (
        <motion.div
            animate={blockControls}
            className="flex h-8 min-w-0 items-center gap-2 overflow-visible text-muted-foreground/65 text-sm leading-5"
            initial={blockInitial}
        >
            {presence}
            <AnimatePresence>
                {label ? (
                    <motion.span
                        animate={labelAnimate}
                        aria-label={labelText ?? undefined}
                        className="thinking-indicator-text flex min-h-8 items-center overflow-hidden whitespace-nowrap tabular-nums"
                        exit={labelExit}
                        initial={labelInitial}
                        key="presence-label"
                        transition={labelTransition}
                    >
                        <PresenceTimingText label={label} reduceMotion={shouldReduceMotion} />
                    </motion.span>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
}

interface PresenceTimingLabel {
    seconds: string | null;
    verb: string;
}

function PresenceTimingText({
    label,
    reduceMotion,
}: {
    label: PresenceTimingLabel;
    reduceMotion: boolean | null;
}) {
    const [slotReady, setSlotReady] = React.useState(false);
    const [slotText, setSlotText] = React.useState('');
    const entryAnimatedRef = React.useRef(false);

    React.useEffect(() => {
        if (reduceMotion !== false) {
            entryAnimatedRef.current = false;
            setSlotReady(false);
            setSlotText('');
            return;
        }

        setSlotReady(true);

        if (entryAnimatedRef.current) {
            setSlotText(label.verb);
            return;
        }

        setSlotText('');

        let cancelled = false;
        const revealText = () => {
            if (cancelled) {
                return;
            }

            entryAnimatedRef.current = true;
            setSlotText(label.verb);
        };

        if (typeof window.requestAnimationFrame === 'function') {
            const frame = window.requestAnimationFrame(revealText);

            return () => {
                cancelled = true;
                window.cancelAnimationFrame(frame);
            };
        }

        const timeout = window.setTimeout(revealText, 16);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [label.verb, reduceMotion]);

    const primingSlot = slotReady && slotText.length === 0;

    const verb = slotReady ? (
        <SlotText
            aria-hidden={true}
            className="presence-verb-slot inline-flex font-medium text-muted-foreground/75"
            options={{
                bounce: 0.35,
                color: chromatic({ from: 210, lightness: 60, saturation: 80, spread: 130 }),
                colorFade: 360,
                direction: 'up',
                duration: 260,
                interrupt: true,
                skipUnchanged: false,
                stagger: 18,
            }}
            text={slotText}
        />
    ) : (
        <span aria-hidden={true} className="inline-flex font-medium text-muted-foreground/75">
            {label.verb}
        </span>
    );

    return (
        <>
            {verb}
            {label.seconds && !primingSlot ? (
                <span aria-hidden={true} className="ml-1 tabular-nums">
                    for {label.seconds}
                </span>
            ) : null}
        </>
    );
}

function formatPresenceTimingLabel(label: PresenceTimingLabel) {
    return label.seconds ? `${label.verb} for ${label.seconds}` : label.verb;
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

function getAgentStatusTimingLabel({
    now,
    start,
    verb,
}: {
    now: number;
    start: string | null;
    verb: string;
}) {
    return {
        seconds: formatActiveActivitySeconds({ now, start }),
        verb,
    };
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
