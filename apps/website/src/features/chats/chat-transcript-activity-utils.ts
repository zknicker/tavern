import type { TranscriptItem, TranscriptRow } from './chat-transcript-model.ts';

export type ActivityItem = Exclude<
    TranscriptItem,
    { kind: 'activeReply' } | { kind: 'activeStatus' } | { kind: 'failure' }
>;

export function isActivityItem(item: TranscriptItem): item is ActivityItem {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return false;
    }

    return item.kind !== 'row' || (item.row.kind !== 'message' && !isNarrationToolRow(item.row));
}

export function isAssistantNarrationItem(
    item: TranscriptItem
): item is Extract<TranscriptItem, { kind: 'row' }> & {
    row: Extract<TranscriptRow, { kind: 'tool' }>;
} {
    return item.kind === 'row' && isNarrationToolRow(item.row);
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

export function getAssistantNarrationText(item: TranscriptItem) {
    if (!isAssistantNarrationItem(item)) {
        return null;
    }

    const label = item.row.toolCall.label?.trim() ?? '';
    const parts = item.row.toolCall.summaryParts.map((part) => part.trim()).filter(Boolean);
    const [firstPart, ...remainingParts] = parts;
    const bodyParts =
        firstPart && isNarrationTitle(firstPart, label) && remainingParts.length > 0
            ? remainingParts
            : parts;
    const text = bodyParts.join('\n').trim() || label;

    return text.length > 0 ? text : null;
}

export function formatWorkGroupHeader(items: ActivityItem[]) {
    const counts = countWorkItems(items);
    const parts = [
        formatCount(counts.explore, 'Explored', 'file'),
        formatCount(counts.edit, 'Edited', 'file'),
        formatCount(counts.command, 'Ran', 'command'),
        formatCount(counts.other, 'Used', 'tool'),
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? joinHeaderParts(parts) : 'Worked';
}

function isNarrationToolRow(row: TranscriptRow) {
    return row.kind === 'tool' && row.toolCall.name.trim().toLowerCase() === 'message';
}

function countWorkItems(items: ActivityItem[]) {
    return items.reduce(
        (counts, item) => {
            if (item.row.kind !== 'tool') {
                counts.other += 1;
                return counts;
            }

            const name = item.row.toolCall.name.trim().toLowerCase();
            const label = item.row.toolCall.label?.trim().toLowerCase() ?? '';
            const summary = item.row.toolCall.summaryParts.join(' ').trim().toLowerCase();
            const text = `${name} ${label} ${summary}`;

            if (
                matchesAny(text, ['patch', 'edit', 'edited', 'write', 'modified', 'file change'])
            ) {
                counts.edit += 1;
                return counts;
            }

            if (
                matchesAny(name, ['read', 'grep', 'search']) ||
                matchesAny(text, ['read ', 'search'])
            ) {
                counts.explore += 1;
                return counts;
            }

            if (matchesAny(name, ['bash', 'command', 'exec', 'shell', 'zsh'])) {
                counts.command += 1;
                return counts;
            }

            counts.other += 1;
            return counts;
        },
        { command: 0, edit: 0, explore: 0, other: 0 }
    );
}

function formatCount(count: number, verb: string, noun: string) {
    if (count === 0) {
        return null;
    }

    return `${verb} ${count} ${noun}${count === 1 ? '' : 's'}`;
}

function joinHeaderParts(parts: string[]) {
    return parts
        .map((part, index) => (index === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1)))
        .join(', ');
}

function isNarrationTitle(value: string, label: string) {
    const normalizedValue = value.trim().toLowerCase();
    const normalizedLabel = label.trim().toLowerCase();

    return (
        normalizedValue === 'assistant reply' ||
        normalizedValue === 'preamble' ||
        (normalizedLabel.length > 0 && normalizedValue === normalizedLabel)
    );
}

function matchesAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(needle));
}
