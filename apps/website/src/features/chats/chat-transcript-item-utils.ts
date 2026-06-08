import { isAssistantNarrationItem } from './chat-transcript-activity-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';

export type AgentItemSegment =
    | { item: TranscriptItem; key: string; kind: 'item' }
    | { items: TranscriptItem[]; key: string; kind: 'activity' };

export function groupAgentItems(items: TranscriptItem[]) {
    const segments: AgentItemSegment[] = [];
    let activityItems: TranscriptItem[] = [];
    let activityGroupKey: string | null = null;

    for (const item of items) {
        if (isTranscriptActivityItem(item)) {
            const nextGroupKind = getActivityGroupKind(item);
            if (activityGroupKey && activityGroupKey !== nextGroupKind) {
                flushActivitySegment(segments, activityItems);
                activityItems = [];
            }
            activityItems.push(item);
            activityGroupKey = nextGroupKind;
            continue;
        }

        flushActivitySegment(segments, activityItems);
        activityItems = [];
        activityGroupKey = null;
        segments.push({ item, key: getTranscriptItemKey(item), kind: 'item' });
    }

    flushActivitySegment(segments, activityItems);

    return segments;
}

export function getVisibleAgentItems(input: {
    items: TranscriptItem[];
    showThinkingText: boolean;
}) {
    if (input.showThinkingText) {
        return input.items;
    }

    return input.items.filter((item) => !isThinkingItem(item));
}

function getActivityGroupKind(item: TranscriptItem) {
    if (item.kind === 'row' && item.row.kind === 'system' && item.row.systemKind === 'thinking') {
        return 'thinking';
    }

    return 'work';
}

function isThinkingItem(item: TranscriptItem) {
    return item.kind === 'row' && item.row.kind === 'system' && item.row.systemKind === 'thinking';
}

function flushActivitySegment(segments: AgentItemSegment[], items: TranscriptItem[]) {
    if (items.length === 0) {
        return;
    }

    segments.push({
        items,
        key: `activity:${getActivityGroupKind(items[0])}:${getTranscriptItemKey(items[0])}`,
        kind: 'activity',
    });
}

export function isTranscriptActivityItem(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return false;
    }

    return item.kind !== 'row' || (item.row.kind !== 'message' && !isAssistantNarrationItem(item));
}

export function getTranscriptItemKey(item: TranscriptItem) {
    if (item.kind === 'activeReply') {
        return `active-reply:${item.reply.runId}`;
    }

    if (item.kind === 'activeStatus') {
        return `active-status:${item.reply.runId}:${item.status}`;
    }

    if (item.kind === 'failure') {
        return `failure:${item.failure.turn.runId}`;
    }

    return item.row.id;
}
