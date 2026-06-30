import { ArrowUp02Icon, Cancel01Icon, Edit02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useAnimation, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Tooltip } from '../../components/ui/tooltip.tsx';
import { cn } from '../../lib/utils.ts';
import { type ChatComposerQueuedMessage, isQueuedMessageSteerable } from './chat-composer-queue.ts';

const queuedCardHeight = 44;
const queuedCardGap = 8;
const collapsedPeek = 12;
const maxCollapsedPeekCount = 2;
const dragRowStep = queuedCardHeight + queuedCardGap;

export function ChatComposerQueuePanel({
    canSteerBlockedMessages,
    className,
    isBlocked,
    onEdit,
    onMove,
    onPromote,
    onRemove,
    onReorder,
    queue,
}: {
    canSteerBlockedMessages: boolean;
    className?: string;
    isBlocked: boolean;
    onEdit: (id: string) => void;
    onMove: (id: string, direction: 'down' | 'up') => void;
    onPromote: (id: string) => void;
    onRemove: (id: string) => void;
    onReorder?: (queue: readonly ChatComposerQueuedMessage[]) => void;
    queue: readonly ChatComposerQueuedMessage[];
}) {
    const controls = useAnimation();
    const prefersReducedMotion = useReducedMotion();
    const [hovered, setHovered] = React.useState(false);
    const [touchDevice, setTouchDevice] = React.useState(false);
    const [forceExpanded, setForceExpanded] = React.useState(false);
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
    const [dragStartIndex, setDragStartIndex] = React.useState<number | null>(null);
    const [dragTargetIndex, setDragTargetIndex] = React.useState<number | null>(null);
    const [dragY, setDragY] = React.useState(0);
    const stackRef = React.useRef<HTMLDivElement | null>(null);
    const dragStartYRef = React.useRef(0);
    const dragTargetIndexRef = React.useRef(0);
    const queueLengthRef = React.useRef(queue.length);
    queueLengthRef.current = queue.length;
    const expanded = hovered || draggingId !== null || activeDragId !== null || forceExpanded;

    React.useEffect(() => {
        const matcher = window.matchMedia('(hover: none)');
        const update = () => setTouchDevice(matcher.matches);
        update();
        matcher.addEventListener('change', update);
        return () => matcher.removeEventListener('change', update);
    }, []);

    React.useEffect(() => {
        if (queue.length === 0) {
            setForceExpanded(false);
        }
    }, [queue.length]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: New queued messages should bump the stack.
    React.useEffect(() => {
        controls.set({ y: -7 });
        void controls.start({
            y: 0,
            transition: { bounce: 0.5, duration: 0.42, type: 'spring' },
        });
    }, [controls, queue.length]);

    React.useEffect(() => {
        if (!draggingId) {
            return;
        }

        let didDrag = false;

        const handlePointerMove = (event: PointerEvent) => {
            const stack = stackRef.current;

            if (!stack) {
                return;
            }

            if (!didDrag) {
                if (Math.abs(event.clientY - dragStartYRef.current) < 4) {
                    return;
                }
                didDrag = true;
                setActiveDragId(draggingId);
            }

            const rect = stack.getBoundingClientRect();
            const pointerDistanceFromBottom = rect.bottom - event.clientY - queuedCardHeight / 2;
            const nextIndex = Math.max(
                0,
                Math.min(
                    queueLengthRef.current - 1,
                    Math.round(pointerDistanceFromBottom / dragRowStep)
                )
            );
            dragTargetIndexRef.current = nextIndex;
            setDragTargetIndex(nextIndex);

            setDragY(
                Math.max(
                    -(dragRowStep * (queueLengthRef.current - 1)),
                    Math.min(0, event.clientY - rect.bottom + queuedCardHeight / 2)
                )
            );
        };

        const endDrag = () => {
            if (didDrag && onReorder) {
                const currentIndex = queue.findIndex((entry) => entry.id === draggingId);
                const targetIndex = dragTargetIndexRef.current;

                if (currentIndex >= 0 && currentIndex !== targetIndex) {
                    const next = [...queue];
                    const [entry] = next.splice(currentIndex, 1);

                    if (entry) {
                        next.splice(targetIndex, 0, entry);
                        onReorder(next);
                    }
                }
            }

            setDraggingId(null);
            setActiveDragId(null);
            setDragStartIndex(null);
            setDragTargetIndex(null);
            setForceExpanded(false);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        };
    }, [draggingId, onReorder, queue]);

    if (queue.length === 0) {
        return null;
    }

    const collapsedHeight =
        queuedCardHeight +
        collapsedPeek * Math.min(Math.max(queue.length - 1, 0), maxCollapsedPeekCount);
    const expandedHeight =
        queuedCardHeight * queue.length + queuedCardGap * Math.max(queue.length - 1, 0);
    const hiddenCount = Math.max(0, queue.length - 3);

    return (
        <AnimatePresence initial={false}>
            <motion.div
                animate={{ height: expanded ? expandedHeight : collapsedHeight, opacity: 1 }}
                className={cn('absolute inset-x-0 bottom-full z-20 mb-2', className)}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') {
                        setHovered(true);
                    }
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType !== 'touch') {
                        setHovered(false);
                    }
                }}
                ref={stackRef}
                transition={
                    prefersReducedMotion
                        ? { duration: 0 }
                        : { bounce: 0, duration: 0.24, type: 'spring' }
                }
            >
                <motion.div animate={controls} className="absolute inset-0">
                    {touchDevice && expanded ? (
                        <Tooltip content="Collapse" side="left">
                            <button
                                aria-label="Collapse queued messages"
                                className="absolute bottom-0 left-0 flex items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setForceExpanded(false);
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                style={{ height: queuedCardHeight, width: 40 }}
                                type="button"
                            >
                                <Icon className="size-4 rotate-180" icon={ArrowUp02Icon} />
                            </button>
                        </Tooltip>
                    ) : (
                        <Tooltip
                            content={`${queue.length} queued message${queue.length === 1 ? '' : 's'}`}
                            side="left"
                        >
                            <button
                                aria-label={`${queue.length} queued message${queue.length === 1 ? '' : 's'}`}
                                className="absolute bottom-0 -left-2 flex items-center justify-end gap-1 rounded-full pr-1 text-muted-foreground/72 outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                                onClick={() => {
                                    if (touchDevice && !expanded) {
                                        setForceExpanded(true);
                                    }
                                }}
                                style={{ height: queuedCardHeight, width: 40 }}
                                type="button"
                            >
                                <AnimatePresence>
                                    {hiddenCount > 0 ? (
                                        <motion.span
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="pointer-events-none font-semibold text-[10px] text-muted-foreground tabular-nums leading-none"
                                            exit={{ opacity: 0, scale: 0.6 }}
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            key="count"
                                        >
                                            {queue.length}
                                        </motion.span>
                                    ) : null}
                                </AnimatePresence>
                                <QueuedCornerDownRightIcon className="size-4" />
                            </button>
                        </Tooltip>
                    )}
                    <AnimatePresence initial={false}>
                        {queue.map((entry, index) => (
                            <QueuedStackCard
                                activeDragId={activeDragId}
                                canSteerBlockedMessages={canSteerBlockedMessages}
                                dragStartIndex={dragStartIndex}
                                dragTargetIndex={dragTargetIndex}
                                dragY={dragY}
                                entry={entry}
                                expanded={expanded}
                                index={index}
                                isBlocked={isBlocked}
                                key={entry.id}
                                onEdit={onEdit}
                                onMove={onMove}
                                onPromote={onPromote}
                                onRemove={onRemove}
                                onStartDrag={(event) => {
                                    if (event.button !== 0) {
                                        return;
                                    }
                                    dragStartYRef.current = event.clientY;
                                    dragTargetIndexRef.current = index;
                                    setDragStartIndex(index);
                                    setDragTargetIndex(index);
                                    setDragY(-(dragRowStep * index));
                                    setDraggingId(entry.id);
                                }}
                                prefersReducedMotion={prefersReducedMotion}
                                touchDevice={touchDevice}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function QueuedStackCard({
    activeDragId,
    canSteerBlockedMessages,
    dragStartIndex,
    dragTargetIndex,
    dragY,
    entry,
    expanded,
    index,
    isBlocked,
    onEdit,
    onMove,
    onPromote,
    onRemove,
    onStartDrag,
    prefersReducedMotion,
    touchDevice,
}: {
    activeDragId: string | null;
    canSteerBlockedMessages: boolean;
    dragStartIndex: number | null;
    dragTargetIndex: number | null;
    dragY: number;
    entry: ChatComposerQueuedMessage;
    expanded: boolean;
    index: number;
    isBlocked: boolean;
    onEdit: (id: string) => void;
    onMove: (id: string, direction: 'down' | 'up') => void;
    onPromote: (id: string) => void;
    onRemove: (id: string) => void;
    onStartDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
    prefersReducedMotion: boolean | null;
    touchDevice: boolean;
}) {
    const attachmentCount = entry.attachments?.length ?? 0;
    const label = entry.content || attachmentSummary(entry.attachments) || 'Attachment';
    const peek = Math.min(index, maxCollapsedPeekCount);
    const isDragging = activeDragId === entry.id;
    const visualIndex = getQueuedDragVisualIndex({
        dragStartIndex,
        dragTargetIndex,
        index,
    });
    const y = expanded
        ? isDragging
            ? dragY
            : -(dragRowStep * visualIndex)
        : -(collapsedPeek * peek);
    const scale = expanded ? (isDragging ? 1.03 : 1) : 1 - 0.05 * peek;
    const opacity = expanded || index <= maxCollapsedPeekCount ? 1 : 0;
    const transition =
        prefersReducedMotion || isDragging
            ? 'none'
            : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease';

    return (
        <motion.div
            aria-label={`Queued message ${index + 1}: ${label}`}
            className={cn(
                'group/qm absolute right-10 bottom-0 left-10 flex select-none items-center gap-2',
                'rounded-[20px] bg-subtle text-muted-foreground text-sm shadow-surface-3',
                attachmentCount > 0 ? 'pl-2' : 'pl-3.5',
                'pr-1.5 active:cursor-grabbing',
                expanded ? 'cursor-grab' : 'cursor-default'
            )}
            onClick={() => {
                if (touchDevice && !expanded) {
                    return;
                }
            }}
            onDoubleClick={() => onEdit(entry.id)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'F2') {
                    event.preventDefault();
                    onEdit(entry.id);
                    return;
                }

                if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    onRemove(entry.id);
                    return;
                }

                if (event.altKey && event.key === 'ArrowUp') {
                    event.preventDefault();
                    onMove(entry.id, 'up');
                    return;
                }

                if (event.altKey && event.key === 'ArrowDown') {
                    event.preventDefault();
                    onMove(entry.id, 'down');
                }
            }}
            onPointerDown={onStartDrag}
            role="listitem"
            style={{
                height: queuedCardHeight,
                opacity,
                transform: `translateY(${y}px) scale(${scale})`,
                transformOrigin: 'bottom center',
                transition,
                zIndex: isDragging ? 200 : 100 - visualIndex,
            }}
            tabIndex={0}
        >
            {attachmentCount > 0 ? (
                <div
                    className={cn(
                        'pointer-events-none flex shrink-0 items-center gap-1',
                        !expanded && index > 0 ? 'opacity-0' : 'opacity-100'
                    )}
                >
                    {entry.attachments?.slice(0, 3).map((attachment, attachmentIndex) => (
                        <QueuedAttachmentThumbnail
                            attachment={attachment}
                            key={queuedAttachmentKey(attachment, attachmentIndex)}
                        />
                    ))}
                    {attachmentCount > 3 ? (
                        <span className="flex size-7 items-center justify-center rounded-md bg-background/40 font-medium text-[11px] text-foreground/80 tabular-nums">
                            +{attachmentCount - 3}
                        </span>
                    ) : null}
                </div>
            ) : null}
            <span
                className={cn(
                    'pointer-events-none min-w-0 flex-1 truncate',
                    !expanded && index > 0 ? 'opacity-0' : 'opacity-100'
                )}
            >
                <span className="truncate text-foreground/80">{label}</span>
            </span>
            <div
                className={cn(
                    'shrink-0 items-center gap-1',
                    touchDevice ? 'flex' : 'hidden group-focus-within/qm:flex group-hover/qm:flex'
                )}
            >
                <QueueIconButton label="Edit queued message" onClick={() => onEdit(entry.id)}>
                    <Icon className="size-5" icon={Edit02Icon} />
                </QueueIconButton>
                <QueueIconButton
                    label={queuedActionLabel({ canSteerBlockedMessages, entry, isBlocked })}
                    onClick={() => onPromote(entry.id)}
                >
                    <Icon className="size-5" icon={ArrowUp02Icon} />
                </QueueIconButton>
                <QueueIconButton label="Remove queued message" onClick={() => onRemove(entry.id)}>
                    <Icon className="size-5" icon={Cancel01Icon} />
                </QueueIconButton>
            </div>
        </motion.div>
    );
}

export function getQueuedDragVisualIndex({
    dragStartIndex,
    dragTargetIndex,
    index,
}: {
    dragStartIndex: number | null;
    dragTargetIndex: number | null;
    index: number;
}) {
    if (dragStartIndex === null || dragTargetIndex === null || dragStartIndex === dragTargetIndex) {
        return index;
    }

    if (dragStartIndex < dragTargetIndex && index > dragStartIndex && index <= dragTargetIndex) {
        return index - 1;
    }

    if (dragStartIndex > dragTargetIndex && index >= dragTargetIndex && index < dragStartIndex) {
        return index + 1;
    }

    return index;
}

function attachmentSummary(attachments: readonly Record<string, unknown>[] | undefined) {
    if (!attachments?.length) {
        return null;
    }

    const first = attachments[0];
    const firstLabel = typeof first?.filename === 'string' ? first.filename : 'Attachment';
    return attachments.length === 1 ? firstLabel : `${firstLabel} +${attachments.length - 1}`;
}

function queuedActionLabel({
    canSteerBlockedMessages,
    entry,
    isBlocked,
}: {
    canSteerBlockedMessages: boolean;
    entry: ChatComposerQueuedMessage;
    isBlocked: boolean;
}) {
    if (!isBlocked) {
        return 'Send queued message now';
    }

    if (isQueuedMessageSteerable(entry)) {
        return canSteerBlockedMessages ? 'Steer queued message now' : 'Send queued message next';
    }

    return 'Send queued message now';
}

function QueueIconButton({
    children,
    label,
    onClick,
}: {
    children: React.ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <Tooltip content={label} side="top">
            <button
                aria-label={label}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                onClick={(event) => {
                    event.stopPropagation();
                    onClick?.();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                type="button"
            >
                {children}
            </button>
        </Tooltip>
    );
}

function QueuedCornerDownRightIcon({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            color="currentColor"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            {/* Inline until HugeIcons exports CornerDownRightIcon in the installed package. */}
            <path d="M19 15.002H12C8.22876 15.002 6.34315 15.002 5.17157 13.8304C4 12.6588 4 10.7732 4 7.00195V4.00195" />
            <path d="M15 20.002C15 20.002 20 16.3195 20 15.0019C20 13.6843 15 10.002 15 10.002" />
        </svg>
    );
}

function QueuedAttachmentThumbnail({
    attachment,
}: {
    attachment: NonNullable<ChatComposerQueuedMessage['attachments']>[number];
}) {
    const isImage = attachment.type === 'inline' && attachment.mediaType.startsWith('image/');

    return (
        <div className="relative size-7 shrink-0 overflow-hidden rounded-md border border-border bg-background/40">
            {isImage ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={28}
                    src={`data:${attachment.mediaType};base64,${attachment.dataBase64}`}
                    width={28}
                />
            ) : (
                <div className="grid size-full place-items-center font-medium text-[9px] text-muted-foreground uppercase">
                    {attachment.filename.split('.').pop()?.slice(0, 3) ?? 'file'}
                </div>
            )}
        </div>
    );
}

function queuedAttachmentKey(
    attachment: NonNullable<ChatComposerQueuedMessage['attachments']>[number],
    index: number
) {
    if (attachment.type === 'inline') {
        return `${attachment.type}:${attachment.filename}:${attachment.sizeBytes}:${index}`;
    }

    return `${attachment.type}:${attachment.filename}:${attachment.path}:${index}`;
}
