import * as React from 'react';
import {
    useMessageScroller,
    useMessageScrollerVisibility,
} from '../../components/ui/message-scroller.tsx';
import {
    PreviewCard,
    PreviewCardCreateHandle,
    PreviewCardPopup,
    PreviewCardTrigger,
} from '../../components/ui/preview-card.tsx';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import type { ChatTurnTimelineMarker } from './chat-turn-timeline-markers.ts';

export {
    buildChatTurnTimelineMarkers,
    type ChatTurnTimelineMarker,
} from './chat-turn-timeline-markers.ts';

export function ChatTurnTimeline({
    anchorRef,
    markers,
}: {
    anchorRef?: React.RefObject<HTMLDivElement | null>;
    markers: ChatTurnTimelineMarker[];
}) {
    const scroller = useMessageScroller();
    const visibility = useMessageScrollerVisibility();
    const activeMarkerIds = React.useMemo(
        () =>
            new Set(
                markers
                    .filter(
                        (marker) =>
                            marker.messageId === visibility.currentAnchorId ||
                            visibility.visibleMessageIds.includes(marker.messageId)
                    )
                    .map((marker) => marker.id)
            ),
        [markers, visibility.currentAnchorId, visibility.visibleMessageIds]
    );

    return (
        <ChatTurnTimelineRail
            activeMarkerIds={activeMarkerIds}
            anchorRef={anchorRef}
            markers={markers}
            onSelect={(marker) => {
                scroller.scrollToMessage(marker.messageId, {
                    align: 'start',
                    behavior: 'smooth',
                    scrollMargin: 32,
                });
            }}
        />
    );
}

export function ChatTurnTimelineRail({
    activeMarkerIds,
    anchorRef,
    markers,
    onSelect,
}: {
    activeMarkerIds?: ReadonlySet<string>;
    anchorRef?: React.RefObject<HTMLDivElement | null>;
    markers: ChatTurnTimelineMarker[];
    onSelect: (marker: ChatTurnTimelineMarker) => void;
}) {
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const previewHandle = React.useMemo(
        () => PreviewCardCreateHandle<ChatTurnTimelineMarker>(),
        []
    );
    const anchorStyle = useChatTurnTimelineAnchor(anchorRef);
    const hoveredIndex = hoveredId ? markers.findIndex((marker) => marker.id === hoveredId) : null;

    if (markers.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label="Chat turn timeline"
            className={cn(
                'pointer-events-none z-20 hidden w-12 md:block',
                anchorStyle ? 'fixed' : 'absolute top-0 bottom-0 -left-2'
            )}
            data-slot="chat-turn-timeline"
            style={anchorStyle}
        >
            <PreviewCard handle={previewHandle}>
                {({ payload }) => (
                    <>
                        <ol
                            className={cn(
                                'flex max-h-[calc(100vh-11rem)] w-12 flex-col items-start justify-center gap-0.5 py-2',
                                anchorStyle ? 'h-full' : 'sticky top-1/2 -translate-y-1/2'
                            )}
                            onPointerLeave={() => setHoveredId(null)}
                        >
                            {markers.map((marker, index) => {
                                const isHovered = hoveredId === marker.id;
                                const isOnScreen = activeMarkerIds?.has(marker.id) ?? false;

                                return (
                                    <li className="pointer-events-auto h-2.5" key={marker.id}>
                                        <PreviewCardTrigger
                                            closeDelay={0}
                                            delay={0}
                                            handle={previewHandle}
                                            payload={marker}
                                            render={
                                                <button
                                                    aria-current={
                                                        isOnScreen ? 'location' : undefined
                                                    }
                                                    aria-label={`Preview turn ${index + 1}: ${marker.userText}`}
                                                    className="group/timeline-dash flex h-2.5 w-12 items-center justify-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                                    onBlur={() => setHoveredId(null)}
                                                    onClick={() => onSelect(marker)}
                                                    onFocus={() => setHoveredId(marker.id)}
                                                    onPointerEnter={() => setHoveredId(marker.id)}
                                                    type="button"
                                                />
                                            }
                                        >
                                            <span
                                                className={cn(
                                                    'block h-0.5 w-11 origin-left transform-gpu rounded-full bg-muted-foreground/30 opacity-70 transition-[transform,background-color,opacity] duration-[95ms] ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform motion-reduce:transition-none',
                                                    isOnScreen &&
                                                        'bg-muted-foreground/75 opacity-95',
                                                    marker.status === 'failed' &&
                                                        !isHovered &&
                                                        'bg-error/70 opacity-90',
                                                    marker.status === 'active' &&
                                                        !isHovered &&
                                                        'bg-foreground/60 opacity-95',
                                                    isHovered && 'bg-foreground opacity-100'
                                                )}
                                                style={{
                                                    transform: `scaleX(${
                                                        getTimelineDashWidth(index, hoveredIndex) /
                                                        44
                                                    })`,
                                                }}
                                            />
                                        </PreviewCardTrigger>
                                    </li>
                                );
                            })}
                        </ol>
                        <PreviewCardPopup
                            className="w-[min(28rem,calc(100vw-6rem))]"
                            collisionPadding={16}
                            instant
                            side="right"
                            sideOffset={12}
                        >
                            {payload ? <ChatTurnTimelinePreview marker={payload} /> : null}
                        </PreviewCardPopup>
                    </>
                )}
            </PreviewCard>
        </nav>
    );
}

function useChatTurnTimelineAnchor(anchorRef?: React.RefObject<HTMLDivElement | null>) {
    const [style, setStyle] = React.useState<React.CSSProperties | undefined>();

    React.useLayoutEffect(() => {
        const anchor = anchorRef?.current;

        if (!anchor) {
            setStyle(undefined);
            return;
        }

        const updateStyle = () => {
            const rect = anchor.getBoundingClientRect();

            setStyle({
                height: rect.height,
                left: rect.left + 18,
                top: rect.top,
            });
        };

        updateStyle();

        const resizeObserver = new ResizeObserver(updateStyle);
        resizeObserver.observe(anchor);
        window.addEventListener('resize', updateStyle);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateStyle);
        };
    }, [anchorRef]);

    return style;
}

export function getTimelineDashWidth(index: number, hoveredIndex: number | null) {
    if (hoveredIndex === null || hoveredIndex < 0) {
        return 12;
    }

    const distance = Math.abs(index - hoveredIndex);

    if (distance === 0) {
        return 44;
    }

    if (distance === 1) {
        return 30;
    }

    if (distance === 2) {
        return 20;
    }

    return 12;
}

function ChatTurnTimelinePreview({ marker }: { marker: ChatTurnTimelineMarker }) {
    return (
        <div className="min-w-0 space-y-2">
            <div className="min-w-0">
                <p className="truncate font-medium text-foreground text-sm leading-5">
                    {marker.userText}
                </p>
                <p className="line-clamp-3 text-muted-foreground text-sm leading-6">
                    {marker.agentText}
                </p>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
                <span>{formatTimelineStatus(marker.status)}</span>
                {marker.timestamp ? (
                    <>
                        <span aria-hidden="true">-</span>
                        <time dateTime={marker.timestamp}>{formatShortTime(marker.timestamp)}</time>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function formatTimelineStatus(status: ChatTurnTimelineMarker['status']) {
    switch (status) {
        case 'active':
            return 'Running';
        case 'failed':
            return 'Failed';
        case 'stopped':
            return 'Stopped';
        case 'completed':
            return 'Completed';
    }
}
