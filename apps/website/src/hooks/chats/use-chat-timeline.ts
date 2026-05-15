import * as React from 'react';
import type { ChatStatusListOutput } from '../../lib/trpc.tsx';
import { applyLogSnapshot, applyReplySnapshot, emptyTimelineState } from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useTimelineContext } from './use-timeline-context.tsx';

export function useChatTimeline(input: {
    activeReply?: ChatStatusListOutput['chats'][number]['activeReply'] | null;
    chatId: string;
    limit: number;
    offset?: number;
}) {
    const query = useChatTimelinePage({
        id: input.chatId,
        limit: input.limit,
        offset: input.offset,
    });
    const activeReply = input.activeReply ?? null;
    const { setLog, setReply, timelineStates } = useTimelineContext();
    const timelineState = timelineStates[input.chatId] ?? emptyTimelineState();
    const projectedWithLog = React.useMemo(
        () => applyLogSnapshot(timelineState, query.data),
        [query.data, timelineState]
    );
    const projectedState = React.useMemo(
        () => applyReplySnapshot(projectedWithLog, activeReply),
        [activeReply, projectedWithLog]
    );

    React.useEffect(() => {
        setLog(input.chatId, query.data);
    }, [input.chatId, query.data, setLog]);

    React.useEffect(() => {
        setReply(input.chatId, activeReply);
    }, [activeReply, input.chatId, setReply]);

    return {
        ...query,
        activeReply: projectedState.activeReply,
        activeReplySteps: projectedState.activeReplySteps,
        failedTurn: projectedState.failedTurn,
        historyLoaded: projectedState.historyLoaded,
        rows: projectedState.timeline,
        totalRows: projectedState.totalRows,
    };
}
