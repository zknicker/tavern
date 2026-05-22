import * as React from 'react';
import type { ChatStatusListOutput } from '../../lib/trpc.tsx';
import { applyLogSnapshot, applyStatusSnapshot } from './chat-timeline-state.ts';
import { useChatTimelinePage } from './use-chat-timeline-page.ts';
import { useChatRuntimeTimelineState, useTimelineActions } from './use-timeline-context.tsx';

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
    const { setLog, setStatus } = useTimelineActions();
    const timelineState = useChatRuntimeTimelineState(input.chatId);
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
    const timelineWithLog = React.useMemo(
        () => applyLogSnapshot(timelineState, query.data),
        [query.data, timelineState]
    );
    const timelineWithStatus = React.useMemo(
        () => applyStatusSnapshot(timelineWithLog, activeStatus),
        [activeStatus, timelineWithLog]
    );

    React.useEffect(() => {
        setLog(input.chatId, query.data);
    }, [input.chatId, query.data, setLog]);

    React.useEffect(() => {
        setStatus(input.chatId, activeStatus);
    }, [activeStatus, input.chatId, setStatus]);

    return {
        ...query,
        activeReply: timelineWithStatus.activeReply,
        activeReplyProgressStartedAt: timelineWithStatus.activeReplyProgressStartedAt,
        activeReplySteps: timelineWithStatus.activeReplySteps,
        completedProgress: timelineWithStatus.completedProgress,
        failedTurn: timelineWithStatus.failedTurn,
        historyLoaded: timelineWithStatus.historyLoaded,
        rows: timelineWithStatus.timeline,
        totalRows: timelineWithStatus.totalRows,
    };
}
