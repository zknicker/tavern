import type { TranscriptItem } from './chat-transcript-model.ts';

export type ActivityItem = Exclude<
    TranscriptItem,
    { kind: 'activeReply' } | { kind: 'activeStatus' } | { kind: 'failure' }
>;

export function isActivityItem(item: TranscriptItem): item is ActivityItem {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return false;
    }

    return item.kind !== 'row' || item.row.kind !== 'message';
}

export function isActiveActivityItem(item: ActivityItem) {
    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return !item.row.completedAt;
    }

    return false;
}

export function getActivityStart(items: ActivityItem[]) {
    return items.map(getActivityStartTimestamp).find((timestamp) => timestamp !== null) ?? null;
}

export function getActivityEnd(items: ActivityItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const timestamp = getActivityEndTimestamp(items[index]);

        if (timestamp) {
            return timestamp;
        }
    }

    return null;
}

function getActivityStartTimestamp(item: ActivityItem | undefined): string | null {
    if (!item) {
        return null;
    }

    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return item.row.startedAt ?? item.row.completedAt;
    }

    if (item.row.kind === 'system') {
        return item.row.timestamp;
    }

    return item.row.message.timestamp;
}

function getActivityEndTimestamp(item: ActivityItem | undefined): string | null {
    if (!item) {
        return null;
    }

    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return item.row.completedAt;
    }

    if (item.row.kind === 'system') {
        return item.row.timestamp;
    }

    return item.row.message.timestamp;
}

export function formatActivityHeader({
    end,
    isActive,
    now,
    start,
}: {
    end: string | null;
    isActive: boolean;
    now: number;
    start: string | null;
}) {
    const duration = formatElapsed(start, isActive ? now : end);

    if (!duration) {
        return isActive ? 'Working' : 'Worked';
    }

    return `${isActive ? 'Working' : 'Worked'} for ${duration}`;
}

export function formatActiveActivitySeconds({ now, start }: { now: number; start: string | null }) {
    if (!start) {
        return null;
    }

    const startMs = Date.parse(start);

    if (Number.isNaN(startMs)) {
        return null;
    }

    return `${Math.floor(Math.max(0, now - startMs) / 1000)}s`;
}

function formatElapsed(start: string | null, end: number | string | null) {
    if (!(start && end)) {
        return null;
    }

    const startMs = Date.parse(start);
    const endMs = typeof end === 'number' ? end : Date.parse(end);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return null;
    }

    const elapsedMs = Math.max(0, endMs - startMs);

    const totalSeconds = Math.max(1, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (hours > 0) {
        parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (minutes > 0) {
        parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return parts.join(' ');
}

export function getActivityItemKey(item: ActivityItem) {
    return item.row.id;
}
