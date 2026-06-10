import { ActivityStep } from './chat-transcript-activity-step.tsx';
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
    showDurationHeader = true,
    turnActive = false,
    turnCompletedAt,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    items: TranscriptItem[];
    showDurationHeader?: boolean;
    turnActive?: boolean;
    turnCompletedAt?: string | null;
    turnStartedAt?: string | null;
}) {
    const activityItems = items.filter(isActivityItem);
    const isActive = turnActive || activityItems.some(isActiveActivityItem);
    const activityEnd = getActivityEnd(activityItems);
    const activityStart = getActivityStart(activityItems);
    const start = activityStart ?? (isActive ? null : (turnStartedAt ?? null));
    const end = isActive ? null : activityEnd ? (turnCompletedAt ?? activityEnd) : null;

    if (activityItems.length === 0) {
        return null;
    }

    const singleItem = activityItems.length === 1 ? activityItems[0] : null;

    // A disclosure wrapping a single tool row is redundant; render the step
    // directly instead of a one-entry work log.
    if (singleItem && singleItem.row.kind === 'tool') {
        return (
            <ActivityStep
                animateEnter={isActive}
                chatId={chatId}
                currentSessionKey={currentSessionKey}
                index={0}
                isLast
                item={singleItem}
            />
        );
    }

    return (
        <WorkingLog
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            end={end}
            items={activityItems}
            showDurationHeader={showDurationHeader}
            start={start}
            status={isActive ? 'active' : 'completed'}
        />
    );
}
