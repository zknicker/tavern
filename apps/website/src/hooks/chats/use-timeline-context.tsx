import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    type ChatReplyUpdate,
    type ChatTimelineState,
    type ChatTurn,
    type ChatTurnProgressStep,
    type ChatTurnStatusUpdate,
    clearTimelineTurn,
    completeTimelineTurn,
    dismissTimelineFailure,
    emptyTimelineState,
    failTimelineTurn,
    optimisticallyStopTimelineTurn,
    patchTimelineProgress,
    removeOptimisticStoppedTurn,
    startTimelineTurn,
    updateTimelineReply,
    updateTimelineTurnStatus,
} from './chat-timeline-state.ts';

interface TimelineActionsValue {
    clearTurn: (input: { chatId: string; runId?: string }) => void;
    completeTurn: (input: {
        chatId: string;
        completedAt: string;
        hasReply?: boolean | null;
        turn: ChatTurn;
    }) => void;
    dismissFailure: (input: { chatId: string; responseId: string }) => void;
    failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
    optimisticallyStopTurn: (input: { chatId: string; runId: string }) => void;
    patchProgress: (input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }) => void;
    removeOptimisticStop: (input: { chatId: string; runId: string }) => void;
    setLog: (chatId: string, log: ChatLogOutput | undefined) => void;
    startTurn: (turn: ChatTurn) => void;
    updateReply: (update: ChatReplyUpdate) => void;
    updateTurnStatus: (update: ChatTurnStatusUpdate) => void;
}

const TimelineActionsContext = React.createContext<TimelineActionsValue | null>(null);
const TimelineStatesContext = React.createContext<Record<string, ChatTimelineState> | null>(null);
const emptyRuntimeTimelineState = emptyTimelineState();

function updateTimelineState(
    current: Record<string, ChatTimelineState>,
    chatId: string,
    updater: (state: ChatTimelineState) => ChatTimelineState
) {
    const existing = current[chatId] ?? emptyTimelineState();
    const next = updater(existing);

    if (next === existing) {
        return current;
    }

    return {
        ...current,
        [chatId]: next,
    };
}

export function TimelineContextProvider({ children }: PropsWithChildren) {
    const [timelineStates, setTimelineStates] = React.useState<Record<string, ChatTimelineState>>(
        {}
    );
    const timelineStatesRef = React.useRef(timelineStates);

    React.useEffect(() => {
        timelineStatesRef.current = timelineStates;
    }, [timelineStates]);

    const setTimelineState = React.useCallback(
        (chatId: string, updater: (state: ChatTimelineState) => ChatTimelineState) => {
            const current = timelineStatesRef.current;
            const next = updateTimelineState(current, chatId, updater);

            if (next === current) {
                return;
            }

            timelineStatesRef.current = next;
            setTimelineStates(next);
        },
        []
    );

    const setLog = React.useCallback(
        (chatId: string, log: ChatLogOutput | undefined) => {
            setTimelineState(chatId, (state) => applyLogSnapshot(state, log));
        },
        [setTimelineState]
    );

    const startTurn = React.useCallback(
        (turn: ChatTurn) => {
            setTimelineState(turn.chatId, (state) => startTimelineTurn(state, turn));
        },
        [setTimelineState]
    );

    const updateReply = React.useCallback(
        (update: ChatReplyUpdate) => {
            setTimelineState(update.turn.chatId, (state) => updateTimelineReply(state, update));
        },
        [setTimelineState]
    );

    const updateTurnStatus = React.useCallback(
        (update: ChatTurnStatusUpdate) => {
            setTimelineState(update.turn.chatId, (state) =>
                updateTimelineTurnStatus(state, update)
            );
        },
        [setTimelineState]
    );

    const patchProgress = React.useCallback(
        (input: { step: ChatTurnProgressStep; timestamp: string; turn: ChatTurn }) => {
            setTimelineState(input.turn.chatId, (state) => patchTimelineProgress(state, input));
        },
        [setTimelineState]
    );

    const clearTurn = React.useCallback(
        (input: { chatId: string; runId?: string }) => {
            setTimelineState(input.chatId, (state) =>
                clearTimelineTurn(state, {
                    runId: input.runId,
                })
            );
        },
        [setTimelineState]
    );

    const optimisticallyStopTurn = React.useCallback(
        (input: { chatId: string; runId: string }) => {
            setTimelineState(input.chatId, (state) =>
                optimisticallyStopTimelineTurn(state, {
                    chatId: input.chatId,
                    runId: input.runId,
                    stoppedAt: new Date().toISOString(),
                })
            );
        },
        [setTimelineState]
    );

    const removeOptimisticStop = React.useCallback(
        (input: { chatId: string; runId: string }) => {
            setTimelineState(input.chatId, (state) =>
                removeOptimisticStoppedTurn(state, { runId: input.runId })
            );
        },
        [setTimelineState]
    );

    const completeTurn = React.useCallback(
        (input: {
            chatId: string;
            completedAt: string;
            hasReply?: boolean | null;
            turn: ChatTurn;
        }) => {
            setTimelineState(input.chatId, (state) =>
                completeTimelineTurn(state, {
                    completedAt: input.completedAt,
                    hasReply: input.hasReply,
                    turn: input.turn,
                })
            );
        },
        [setTimelineState]
    );

    const failTurn = React.useCallback(
        (input: { chatId: string; error: string; turn: ChatTurn }) => {
            setTimelineState(input.chatId, (state) =>
                failTimelineTurn(state, {
                    error: input.error,
                    turn: input.turn,
                })
            );
        },
        [setTimelineState]
    );

    const dismissFailure = React.useCallback(
        (input: { chatId: string; responseId: string }) => {
            setTimelineState(input.chatId, (state) =>
                dismissTimelineFailure(state, { responseId: input.responseId })
            );
        },
        [setTimelineState]
    );

    const actions = React.useMemo<TimelineActionsValue>(
        () => ({
            clearTurn,
            completeTurn,
            dismissFailure,
            failTurn,
            optimisticallyStopTurn,
            patchProgress,
            removeOptimisticStop,
            setLog,
            startTurn,
            updateReply,
            updateTurnStatus,
        }),
        [
            clearTurn,
            completeTurn,
            dismissFailure,
            failTurn,
            optimisticallyStopTurn,
            patchProgress,
            removeOptimisticStop,
            setLog,
            startTurn,
            updateReply,
            updateTurnStatus,
        ]
    );

    return React.createElement(
        TimelineActionsContext.Provider,
        { value: actions },
        React.createElement(TimelineStatesContext.Provider, { value: timelineStates }, children)
    );
}

export function useTimelineActions() {
    const context = React.useContext(TimelineActionsContext);

    if (context === null) {
        throw new Error('useTimelineActions must be used within a TimelineContextProvider.');
    }

    return context;
}

export function useChatRuntimeTimelineState(chatId: string) {
    return useChatRuntimeTimelineStates()[chatId] ?? emptyRuntimeTimelineState;
}

export function useChatRuntimeTimelineStates() {
    const timelineStates = React.useContext(TimelineStatesContext);

    if (timelineStates === null) {
        throw new Error(
            'useChatRuntimeTimelineStates must be used within a TimelineContextProvider.'
        );
    }

    return timelineStates;
}
