import type { TranscriptItem } from './chat-transcript-model.ts';

export type AgentItemSegment =
    | { item: TranscriptItem; key: string; kind: 'item' }
    | { items: TranscriptItem[]; key: string; kind: 'activity' };

export function groupAgentItems(items: TranscriptItem[]) {
    const segments: AgentItemSegment[] = [];
    let activityItems: TranscriptItem[] = [];

    for (const item of items) {
        if (isTranscriptActivityItem(item)) {
            activityItems.push(item);
            continue;
        }

        flushActivitySegment(segments, activityItems);
        activityItems = [];
        segments.push({ item, key: getTranscriptItemKey(item), kind: 'item' });
    }

    flushActivitySegment(segments, activityItems);

    return segments;
}

function flushActivitySegment(segments: AgentItemSegment[], items: TranscriptItem[]) {
    if (items.length === 0) {
        return;
    }

    segments.push({
        items,
        key: `activity:${items.map(getTranscriptItemKey).join(':')}`,
        kind: 'activity',
    });
}

export function isTranscriptActivityItem(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return false;
    }

    return item.kind !== 'row' || item.row.kind !== 'message';
}

export function getTranscriptItemKey(item: TranscriptItem) {
    if (item.kind === 'activeReply') {
        return `active-reply:${item.reply.runId}`;
    }

    if (item.kind === 'activeStatus') {
        return `active-status:${item.reply.runId}:${item.status}`;
    }

    if (item.kind === 'activeProgress') {
        return `active-progress:${item.reply.runId}`;
    }

    if (item.kind === 'failure') {
        return `failure:${item.failure.turn.runId}`;
    }

    return item.row.id;
}
