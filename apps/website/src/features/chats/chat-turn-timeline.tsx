import * as React from 'react';
import {
    PreviewCard,
    PreviewCardPopup,
    PreviewCardTrigger,
} from '../../components/ui/preview-card.tsx';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import {
    getItemSessionKey,
    isActivityBackedMessageRow,
    type TranscriptEntry,
    type TranscriptItem,
} from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';

export interface ChatTurnTimelineMarker {
    agentRowIndex: number;
    agentText: string;
    id: string;
    rowIndex: number;
    status: 'active' | 'completed' | 'failed' | 'stopped';
    timestamp: string | null;
    userText: string;
}

export function ChatTurnTimelineRail({
    activeMarkerIds,
    markers,
    onSelect,
}: {
    activeMarkerIds?: ReadonlySet<string>;
    markers: ChatTurnTimelineMarker[];
    onSelect: (marker: ChatTurnTimelineMarker) => void;
}) {
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const hoveredIndex = hoveredId ? markers.findIndex((marker) => marker.id === hoveredId) : null;

    if (markers.length === 0) {
        return null;
    }

    return (
        <nav
            aria-label="Chat turn timeline"
            className="pointer-events-none absolute top-0 bottom-0 -left-2 z-20 hidden w-12 md:block"
        >
            <ol className="sticky top-1/2 flex max-h-[calc(100vh-11rem)] w-12 -translate-y-1/2 flex-col items-start justify-center gap-0.5 py-2">
                {markers.map((marker, index) => {
                    const isHovered = hoveredId === marker.id;
                    const isOnScreen = activeMarkerIds?.has(marker.id) ?? false;

                    return (
                        <li className="pointer-events-auto h-2.5" key={marker.id}>
                            <PreviewCard>
                                <PreviewCardTrigger
                                    render={
                                        <button
                                            aria-current={isOnScreen ? 'location' : undefined}
                                            aria-label={`Preview turn ${index + 1}: ${marker.userText}`}
                                            className="group/timeline-dash flex h-2.5 w-12 items-center justify-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                            onBlur={() => setHoveredId(null)}
                                            onClick={() => onSelect(marker)}
                                            onFocus={() => setHoveredId(marker.id)}
                                            onMouseEnter={() => setHoveredId(marker.id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                            type="button"
                                        />
                                    }
                                >
                                    <span
                                        className={cn(
                                            'block h-0.5 rounded-full bg-muted-foreground/30 opacity-70 transition-[width,background-color,opacity] duration-150 ease-out motion-reduce:transition-none',
                                            isOnScreen && 'bg-muted-foreground/75 opacity-95',
                                            marker.status === 'failed' &&
                                                !isHovered &&
                                                'bg-error/70 opacity-90',
                                            marker.status === 'active' &&
                                                !isHovered &&
                                                'bg-foreground/60 opacity-95',
                                            isHovered && 'bg-foreground opacity-100'
                                        )}
                                        style={{
                                            width: getTimelineDashWidth(index, hoveredIndex),
                                        }}
                                    />
                                </PreviewCardTrigger>
                                <PreviewCardPopup
                                    className="w-[min(28rem,calc(100vw-6rem))]"
                                    collisionPadding={16}
                                    side="right"
                                    sideOffset={12}
                                >
                                    <ChatTurnTimelinePreview marker={marker} />
                                </PreviewCardPopup>
                            </PreviewCard>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export function buildChatTurnTimelineMarkers(
    rows: TranscriptRenderRow[]
): ChatTurnTimelineMarker[] {
    const markers: ChatTurnTimelineMarker[] = [];
    let pendingUser: {
        entry: Extract<TranscriptEntry, { kind: 'turn' }>;
        rowIndex: number;
    } | null = null;

    rows.forEach((row, rowIndex) => {
        if (row.kind !== 'entry' || row.entry.kind !== 'turn') {
            return;
        }

        if (row.entry.participant === 'user') {
            pendingUser = { entry: row.entry, rowIndex };
            return;
        }

        if (row.entry.participant !== 'agent' || !pendingUser) {
            return;
        }

        if (!entriesShareSession(pendingUser.entry, row.entry)) {
            pendingUser = null;
            return;
        }

        const userText = getUserPreviewText(pendingUser.entry);

        if (!userText) {
            pendingUser = null;
            return;
        }

        markers.push({
            agentText: getAgentPreviewText(row.entry),
            agentRowIndex: rowIndex,
            id: row.entry.responseId ?? `${pendingUser.entry.id}:${row.entry.id}`,
            rowIndex: pendingUser.rowIndex,
            status: getAgentTurnStatus(row.entry),
            timestamp: pendingUser.entry.timestamp ?? row.entry.timestamp,
            userText,
        });
        pendingUser = null;
    });

    return markers;
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

function entriesShareSession(
    userEntry: Extract<TranscriptEntry, { kind: 'turn' }>,
    agentEntry: Extract<TranscriptEntry, { kind: 'turn' }>
) {
    const userSessionKey = getEntrySessionKey(userEntry);
    const agentSessionKey = getEntrySessionKey(agentEntry);

    return !(userSessionKey && agentSessionKey) || userSessionKey === agentSessionKey;
}

function getEntrySessionKey(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    return entry.items.map(getItemSessionKey).find((value) => value !== null) ?? null;
}

function getUserPreviewText(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    return (
        entry.items
            .map((item) => (item.kind === 'row' && item.row.kind === 'message' ? item.row : null))
            .filter((row) => row?.message.senderType === 'user')
            .map((row) => row?.message.content ?? '')
            .find((content) => content.trim().length > 0) ?? ''
    ).trim();
}

function getAgentPreviewText(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    for (let index = entry.items.length - 1; index >= 0; index -= 1) {
        const item = entry.items[index];
        const text = getAgentItemPreviewText(item);

        if (text) {
            return text;
        }
    }

    return 'Working...';
}

function getAgentItemPreviewText(item: TranscriptItem | undefined) {
    if (!item) {
        return '';
    }

    if (item.kind === 'activeReply') {
        return item.reply.text?.trim() || 'Writing reply...';
    }

    if (item.kind === 'activeStatus') {
        return 'Thinking...';
    }

    if (item.kind === 'failure') {
        return item.failure.error.trim() || 'Response failed.';
    }

    if (item.row.kind === 'message' && !isActivityBackedMessageRow(item.row)) {
        return item.row.message.content.trim();
    }

    if (item.row.kind === 'system' && item.row.systemKind === 'turnStatus') {
        return item.row.turnStatus.text.trim();
    }

    return '';
}

function getAgentTurnStatus(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    if (entry.items.some((item) => item.kind === 'failure')) {
        return 'failed';
    }

    if (
        entry.items.some(
            (item) =>
                item.kind === 'row' &&
                item.row.kind === 'system' &&
                item.row.systemKind === 'turnStatus'
        )
    ) {
        return 'stopped';
    }

    if (entry.items.some((item) => item.kind === 'activeReply' || item.kind === 'activeStatus')) {
        return 'active';
    }

    return 'completed';
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
