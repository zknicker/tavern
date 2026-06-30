import * as React from 'react';
import { applyLogSnapshot, applyReplySnapshot } from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useChatRuntimeTimelineState, useTimelineActions } from './use-timeline-context.tsx';

const activeTurnRefetchIntervalMs = 1000;

export function useChatTimeline(input: { chatId: string; limit: number }) {
    const query = useChatTimelinePage({
        id: input.chatId,
        limit: input.limit,
    });
    const { setLog } = useTimelineActions();
    const timelineState = useChatRuntimeTimelineState(input.chatId);
    const timelineWithLog = React.useMemo(() => {
        const withLog = applyLogSnapshot(timelineState, query.data);

        return query.data?.activeReply
            ? applyReplySnapshot(withLog, query.data.activeReply)
            : withLog;
    }, [query.data, timelineState]);

    React.useEffect(() => {
        setLog(input.chatId, query.data);
    }, [input.chatId, query.data, setLog]);

    const activeReplyRunId = timelineWithLog.activeReply?.runId ?? null;

    React.useEffect(() => {
        if (!activeReplyRunId) {
            return;
        }

        const interval = window.setInterval(() => {
            void query.refetch();
        }, activeTurnRefetchIntervalMs);

        return () => window.clearInterval(interval);
    }, [activeReplyRunId, query.refetch]);

    return {
        ...query,
        activeReply: timelineWithLog.activeReply,
        activeTurn: timelineWithLog.activeTurn,
        failedTurn: timelineWithLog.failedTurn,
        historyLoaded: timelineWithLog.historyLoaded,
        rows: timelineWithLog.timeline,
        totalMessages: timelineWithLog.totalMessages,
    };
}
