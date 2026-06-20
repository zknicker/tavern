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
import { useActorProfile } from '../../hooks/actors/use-actor.ts';
import { isLocalTimelineMessageMetadata } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { useChatDismiss } from '../../hooks/chats/use-chat-dismiss.ts';
import { formatShortTime } from '../../lib/format.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { AgentRichResponse } from '../../rich-responses/render-rich-response.tsx';
import { AgentPresenceIndicator } from './agent-presence-indicator.tsx';
import { getActivePresenceVerb } from './chat-active-presence-verb.ts';
import { CommandRunEntry } from './chat-command-card.tsx';
import { ChatInlineMarkdownText } from './chat-inline-markdown-text.tsx';
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

const rowClassName = 'relative w-full px-3';
const newTurnGapClassName = '';
const hoverGroupClassName = 'group';
const agentPresenceSize = 32;
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
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    entry,
    followsRuntimeNotice,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
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

export function AgentPresenceTranscriptRow({
    activeReply,
    activePresenceVerb,
    agentPresenceColor,
    conversationLayout,
    entry,
    failedTurn,
    presenceRows,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    activePresenceVerb?: string | null;
    agentPresenceColor: string | null;
    conversationLayout: ConversationMessageLayout;
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
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const presenceOnlyTurn = items.every((item) => item.kind === 'activeStatus');
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
              verb: activePresenceVerb ?? getActivePresenceVerb(activeReply?.runId ?? entry.id),
          })
        : null;
    const presence = (
        <AgentPresenceRow
            label={presenceTimingLabel}
            presence={
                <AgentPresenceIndicator
                    activeReply={presenceActiveReply}
                    className="translate-y-px"
                    color={actorProfile?.primaryColor ?? agentPresenceColor}
                    failedTurn={failedTurn}
                    rows={presenceRows}
                    size={agentPresenceSize}
                />
            }
        />
    );

    if (conversationLayout.showAgentIdentity) {
        return (
            <div className={cn(rowClassName, presenceOnlyTurn ? newTurnGapClassName : null)}>
                {presenceOnlyTurn ? (
                    <div className="mb-1.5 min-w-0 truncate font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                        {displayName}
                    </div>
                ) : null}
                {presence}
            </div>
        );
    }

    return <div className={rowClassName}>{presence}</div>;
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
            <div
                className={cn(rowClassName, 'flex flex-col items-end gap-1.5', newTurnGapClassName)}
            >
                {entry.items.map((item) => (
                    <UserTurnItem
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
            <div className="relative min-w-0 max-w-[min(42rem,82%)]">
                <div className="relative min-w-0">
                    <div className="mb-1.5 min-w-0 truncate pr-4 text-right font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                        {displayName}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        {entry.items.map((item) => (
                            <UserTurnItem
                                className="max-w-[100%]"
                                item={item}
                                key={getTranscriptItemKey(item)}
                                showMeta={isMessageItem(item, lastMessage)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgentTurn({
    activeReply,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
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
    return (
        <div
            className={cn(
                rowClassName,
                showIdentity ? newTurnGapClassName : followsRuntimeNotice ? 'mt-0' : null
            )}
        >
            <div>
                <div className={cn(hoverGroupClassName, 'w-full min-w-0')}>
                    {showIdentity ? (
                        <div className="mb-1.5 min-w-0 truncate font-medium text-[0.8125rem] text-muted-foreground/80 leading-none">
                            {displayName}
                        </div>
                    ) : null}
                    <div className="relative min-w-0">
                        <div className="flex min-w-0 flex-col gap-3">
                            {visibleSegments.map((segment, index) => (
                                <AgentTurnSegment
                                    chatId={chatId}
                                    currentSessionKey={currentSessionKey}
                                    defaultOpenWorkGroups={defaultOpenWorkGroups}
                                    key={segment.key}
                                    lastMessage={lastMessage}
                                    segment={segment}
                                    turnActive={turnActive && index === visibleSegments.length - 1}
                                    turnCompletedAt={turnCompletedAt}
                                    turnStartedAt={turnStartedAt}
                                    turnStopped={turnStopped}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AgentPresenceRow({
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
    lastMessage,
    segment,
    turnActive,
    turnCompletedAt,
    turnStopped,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    lastMessage: Extract<TranscriptRow, { kind: 'message' }>['message'] | null;
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

function UserTurnItem({
    className,
    item,
    showMeta,
}: {
    className?: string;
    item: TranscriptItem;
    showMeta: boolean;
}) {
    if (item.kind !== 'row' || item.row.kind !== 'message') {
        return null;
    }

    const message = item.row.message;
    const attachments = renderTranscriptMessageAttachments(message.attachments);
    const body = <ChatTranscriptMessageContent message={message} textClassName="text-current" />;

    return body ? (
        <ChatMessage
            actions={showMeta ? <TranscriptMessageActions value={message.content} /> : null}
            animateEnter={isLocalTimelineMessageMetadata(message.metadata)}
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
        return (
            <AssistantReplyText
                content={getActiveReplyDisplayText(item.reply.text ?? '')}
                copyValue={item.reply.text ?? ''}
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
        const message = item.row.message;

        return (
            <AssistantReplyText message={message} showActions={message.id === lastMessage?.id} />
        );
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
    copyValue,
    message,
    revealKey,
    revealText = false,
    showActions = false,
}: {
    content?: string;
    copyValue?: string;
    message?: TranscriptMessage;
    revealKey?: string;
    revealText?: boolean;
    showActions?: boolean;
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
    const actions = message ? (
        showActions ? (
            <TranscriptMessageActions value={message.content} />
        ) : null
    ) : (
        <TranscriptMessageActions disabled value={copyValue ?? revealedText} />
    );

    return (
        <ChatMessage
            actions={actions}
            animateEnter={false}
            attachments={attachments}
            className="max-w-[100%]"
            from="assistant"
        >
            {message ? (
                <ChatTranscriptMessageContent
                    animatedRanges={animatedRanges}
                    contentOverride={revealedText}
                    message={message}
                />
            ) : (
                <ChatInlineMarkdownText animatedRanges={animatedRanges} content={revealedText} />
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
