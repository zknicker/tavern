import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    type ChatActiveReply,
    type ChatReplyUpdate,
    type ChatTimelineState,
    type ChatTurn,
    type ChatTurnProgressStep,
    clearTimelineTurn,
    completeTimelineTurn,
    dismissTimelineFailure,
    emptyTimelineState,
    failTimelineTurn,
    patchTimelineProgress,
    startTimelineTurn,
    updateTimelineReply,
} from './chat-timeline-state.ts';

interface TimelineActionsValue {
    clearTurn: (input: { chatId: string; runId?: string }) => void;
    completeTurn: (input: { chatId: string; completedAt: string; turn: ChatTurn }) => void;
    dismissFailure: (input: { chatId: string; responseId: string }) => void;
    failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
    patchProgress: (input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }) => void;
    setLog: (chatId: string, log: ChatLogOutput | undefined) => void;
    setReply: (chatId: string, activeReply: ChatActiveReply | null) => void;
    startTurn: (turn: ChatTurn) => void;
    updateReply: (update: ChatReplyUpdate) => void;
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

    const setLog = React.useCallback((chatId: string, log: ChatLogOutput | undefined) => {
        setTimelineStates((current) =>
            updateTimelineState(current, chatId, (state) => applyLogSnapshot(state, log))
        );
    }, []);

    const setReply = React.useCallback((chatId: string, activeReply: ChatActiveReply | null) => {
        setTimelineStates((current) =>
            updateTimelineState(current, chatId, (state) => applyReplySnapshot(state, activeReply))
        );
    }, []);

    const startTurn = React.useCallback((turn: ChatTurn) => {
        setTimelineStates((current) =>
            updateTimelineState(current, turn.chatId, (state) => startTimelineTurn(state, turn))
        );
    }, []);

    const updateReply = React.useCallback((update: ChatReplyUpdate) => {
        setTimelineStates((current) =>
            updateTimelineState(current, update.turn.chatId, (state) =>
                updateTimelineReply(state, update)
            )
        );
    }, []);

    const patchProgress = React.useCallback(
        (input: { step: ChatTurnProgressStep; timestamp: string; turn: ChatTurn }) => {
            setTimelineStates((current) =>
                updateTimelineState(current, input.turn.chatId, (state) =>
                    patchTimelineProgress(state, input)
                )
            );
        },
        []
    );

    const clearTurn = React.useCallback((input: { chatId: string; runId?: string }) => {
        setTimelineStates((current) =>
            updateTimelineState(current, input.chatId, (state) =>
                clearTimelineTurn(state, {
                    runId: input.runId,
                })
            )
        );
    }, []);

    const completeTurn = React.useCallback(
        (input: { chatId: string; completedAt: string; turn: ChatTurn }) => {
            setTimelineStates((current) =>
                updateTimelineState(current, input.chatId, (state) =>
                    completeTimelineTurn(state, {
                        completedAt: input.completedAt,
                        turn: input.turn,
                    })
                )
            );
        },
        []
    );

    const failTurn = React.useCallback(
        (input: { chatId: string; error: string; turn: ChatTurn }) => {
            setTimelineStates((current) =>
                updateTimelineState(current, input.chatId, (state) =>
                    failTimelineTurn(state, {
                        error: input.error,
                        turn: input.turn,
                    })
                )
            );
        },
        []
    );

    const dismissFailure = React.useCallback((input: { chatId: string; responseId: string }) => {
        setTimelineStates((current) =>
            updateTimelineState(current, input.chatId, (state) =>
                dismissTimelineFailure(state, { responseId: input.responseId })
            )
        );
    }, []);

    const actions = React.useMemo<TimelineActionsValue>(
        () => ({
            clearTurn,
            completeTurn,
            dismissFailure,
            failTurn,
            patchProgress,
            setLog,
            setReply,
            startTurn,
            updateReply,
        }),
        [
            clearTurn,
            completeTurn,
            dismissFailure,
            failTurn,
            patchProgress,
            setLog,
            setReply,
            startTurn,
            updateReply,
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
    const timelineStates = React.useContext(TimelineStatesContext);

    if (timelineStates === null) {
        throw new Error(
            'useChatRuntimeTimelineState must be used within a TimelineContextProvider.'
        );
    }

    return timelineStates[chatId] ?? emptyRuntimeTimelineState;
}
