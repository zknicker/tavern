import {
    getActivityEnd,
    getActivityStart,
    isActiveActivityItem,
    isActivityItem,
} from './chat-transcript-activity-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { WorkingLog } from './working-log.tsx';

export function ChatTranscriptActivity({
    chatId,
    currentSessionKey,
    item,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    item: TranscriptItem;
}) {
    return (
        <ChatTranscriptActivityGroup
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            items={[item]}
        />
    );
}

export function ChatTranscriptActivityGroup({
    chatId,
    currentSessionKey,
    items,
    turnCompletedAt,
    turnStartedAt,
}: {
    chatId?: string;
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
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            end={end}
            items={activityItems}
            start={start}
            status={isActive ? 'active' : 'completed'}
        />
    );
}
