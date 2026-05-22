import * as React from 'react';
import { applyLogSnapshot } from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useChatRuntimeTimelineState, useTimelineActions } from './use-timeline-context.tsx';

export function useChatTimeline(input: { chatId: string; limit: number; offset?: number }) {
    const query = useChatTimelinePage({
        id: input.chatId,
        limit: input.limit,
        offset: input.offset,
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
        activeReply: timelineWithLog.activeReply,
        failedTurn: timelineWithLog.failedTurn,
        historyLoaded: timelineWithLog.historyLoaded,
        rows: timelineWithLog.timeline,
        totalRows: timelineWithLog.totalRows,
    };
}
