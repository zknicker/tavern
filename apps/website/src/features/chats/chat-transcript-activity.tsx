import {
    getActivityEnd,
    getActivityStart,
    isActiveActivityItem,
    isActivityItem,
} from './chat-transcript-activity-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { WorkingLog } from './working-log.tsx';

export function ChatTranscriptActivity({
    currentSessionKey,
    item,
}: {
    currentSessionKey?: string | null;
    item: TranscriptItem;
}) {
    return <ChatTranscriptActivityGroup currentSessionKey={currentSessionKey} items={[item]} />;
}

export function ChatTranscriptActivityGroup({
    currentSessionKey,
    items,
    turnCompletedAt,
    turnStartedAt,
}: {
    currentSessionKey?: string | null;
    items: TranscriptItem[];
    turnCompletedAt?: string | null;
    turnStartedAt?: string | null;
}) {
    const activityItems = items.filter(isActivityItem);
    const isActive = activityItems.some(isActiveActivityItem);
    const activityEnd = getActivityEnd(activityItems);
    const activityStart = getActivityStart(activityItems);
    const start = activityStart ?? (isActive ? null : (turnStartedAt ?? null));
    const end = isActive ? null : activityEnd ? (turnCompletedAt ?? activityEnd) : null;

    if (activityItems.length === 0) {
        return null;
    }

    return (
        <WorkingLog
            currentSessionKey={currentSessionKey}
            end={end}
            items={activityItems}
            start={start}
            status={isActive ? 'active' : 'completed'}
        />
    );
}
