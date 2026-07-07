import * as React from 'react';
import { applyLogSnapshot } from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useChatRuntimeTimelineState, useTimelineActions } from './use-timeline-context.tsx';

// Event-driven updates own the live turn end to end: progress events patch
// the cache, named invalidation events refetch at completion, the websocket
// client refetches active queries on reconnect, and the server replays
// missed runtime events after its own reconnect. No mid-turn polling.
export function useChatTimeline(input: { chatId: string; limit: number }) {
    const query = useChatTimelinePage({
        id: input.chatId,
        limit: input.limit,
    });
    const { setLog } = useTimelineActions();
    const timelineState = useChatRuntimeTimelineState(input.chatId);
    const timelineWithLog = React.useMemo(
        () => applyLogSnapshot(timelineState, query.data),
        [query.data, timelineState]
    );

    React.useEffect(() => {
        setLog(input.chatId, query.data);
    }, [input.chatId, query.data, setLog]);

    return {
        ...query,
        activeReplies: timelineWithLog.activeReplies,
        activeTurns: timelineWithLog.activeTurns,
        failedTurns: timelineWithLog.failedTurns,
        historyLoaded: timelineWithLog.historyLoaded,
        rows: timelineWithLog.timeline,
        totalMessages: timelineWithLog.totalMessages,
    };
}
