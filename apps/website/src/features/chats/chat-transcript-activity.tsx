import * as React from 'react';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    formatActivityHeader,
    getActivityEnd,
    getActivityItemKey,
    getActivityStart,
    isActiveActivityItem,
    isActivityItem,
} from './chat-transcript-activity-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { ThinkingSteps, ThinkingStepsContent, ThinkingStepsHeader } from './thinking-steps.tsx';

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
    const start = !isActive && turnStartedAt ? turnStartedAt : getActivityStart(activityItems);
    const end = isActive ? null : activityEnd ? (turnCompletedAt ?? activityEnd) : null;
    const now = useNow(isActive && start !== null);

    if (activityItems.length === 0) {
        return null;
    }

    return (
        <ThinkingSteps className="w-full max-w-[34rem]" defaultOpen={false}>
            <ThinkingStepsHeader>
                {formatActivityHeader({ end, isActive, now, start })}
            </ThinkingStepsHeader>
            <ThinkingStepsContent>
                {activityItems.map((item, index) => (
                    <ActivityStep
                        currentSessionKey={currentSessionKey}
                        index={index}
                        isLast={index === activityItems.length - 1}
                        item={item}
                        key={getActivityItemKey(item)}
                    />
                ))}
            </ThinkingStepsContent>
        </ThinkingSteps>
    );
}

function useNow(enabled: boolean) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [enabled]);

    return now;
}
