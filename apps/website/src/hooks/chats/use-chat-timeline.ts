import * as React from 'react';
import type { ChatStatusListOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    applyStatusSnapshot,
    emptyTimelineState,
} from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useTimelineContext } from './use-timeline-context.tsx';

export function useChatTimeline(input: {
    activeReply?: ChatStatusListOutput['chats'][number]['activeReply'] | null;
    activeReplyProgressStartedAt?: string | null;
    activeReplySteps?: ChatStatusListOutput['chats'][number]['activeReplySteps'];
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
    const { setLog, setStatus, timelineStates } = useTimelineContext();
    const timelineState = timelineStates[input.chatId] ?? emptyTimelineState();
    const activeStatus = React.useMemo(
        () =>
            activeReply
                ? {
                      activeReply,
                      activeReplyProgressStartedAt: input.activeReplyProgressStartedAt ?? null,
                      activeReplySteps: input.activeReplySteps ?? [],
                      chatId: input.chatId,
                  }
                : null,
        [activeReply, input.activeReplyProgressStartedAt, input.activeReplySteps, input.chatId]
    );
    const projectedWithLog = React.useMemo(
        () => applyLogSnapshot(timelineState, query.data),
        [query.data, timelineState]
    );
    const projectedState = React.useMemo(
        () => applyStatusSnapshot(projectedWithLog, activeStatus),
        [activeStatus, projectedWithLog]
    );

    React.useEffect(() => {
        setLog(input.chatId, query.data);
    }, [input.chatId, query.data, setLog]);

    React.useEffect(() => {
        setStatus(input.chatId, activeStatus);
    }, [activeStatus, input.chatId, setStatus]);

    return {
        ...query,
        activeReply: projectedState.activeReply,
        activeReplyProgressStartedAt: projectedState.activeReplyProgressStartedAt,
        activeReplySteps: projectedState.activeReplySteps,
        completedProgress: projectedState.completedProgress,
        failedTurn: projectedState.failedTurn,
        historyLoaded: projectedState.historyLoaded,
        rows: projectedState.timeline,
        totalRows: projectedState.totalRows,
    };
}
