import * as React from 'react';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    type ActivityItem,
    formatActiveActivitySeconds,
    formatActivityHeader,
    getActivityItemKey,
} from './chat-transcript-activity-utils.ts';
import { ThinkingSteps, ThinkingStepsContent, ThinkingStepsHeader } from './thinking-steps.tsx';

export function WorkingLog({
    chatId,
    currentSessionKey,
    end,
    items,
    start,
    status,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    end: string | null;
    items: ActivityItem[];
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;
    const defaultOpen = isActive || hasNarration(items);

    return (
        <ThinkingSteps className="w-full max-w-[34rem]" defaultOpen={defaultOpen}>
            <ThinkingStepsHeader>
                {isActive && activeSeconds ? (
                    <span>
                        Working for{' '}
                        <span className="inline-block min-w-[2.2ch] text-left tabular-nums">
                            {activeSeconds}
                        </span>
                    </span>
                ) : (
                    formatActivityHeader({ end, isActive, now, start })
                )}
            </ThinkingStepsHeader>
            <ThinkingStepsContent>
                {items.map((item, index) => (
                    <ActivityStep
                        chatId={chatId}
                        currentSessionKey={currentSessionKey}
                        index={index}
                        isLast={index === items.length - 1}
                        item={item}
                        key={getActivityItemKey(item)}
                    />
                ))}
            </ThinkingStepsContent>
        </ThinkingSteps>
    );
}

function hasNarration(items: ActivityItem[]) {
    return items.some((item) => {
        if (item.row.kind === 'system') {
            return item.row.systemKind === 'thinking';
        }

        if (item.row.kind !== 'tool') {
            return false;
        }

        const name = item.row.toolCall.name.trim().toLowerCase();
        return name === 'message' || name === 'reasoning';
    });
}

function useNow(enabled: boolean, start: string | null) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const updateNow = () => setNow(Date.now());
        const startMs = start ? Date.parse(start) : Number.NaN;
        const elapsedMs = Number.isNaN(startMs) ? 0 : Math.max(0, Date.now() - startMs);
        const delayMs = Number.isNaN(startMs) ? 1000 : 1000 - (elapsedMs % 1000);
        let interval: number | undefined;

        updateNow();

        const timeout = window.setTimeout(
            () => {
                updateNow();
                interval = window.setInterval(updateNow, 1000);
            },
            Math.max(100, delayMs)
        );

        return () => {
            window.clearTimeout(timeout);

            if (interval !== undefined) {
                window.clearInterval(interval);
            }
        };
    }, [enabled, start]);

    return now;
}
