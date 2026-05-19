import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    applyStatusSnapshot,
    type ChatActiveStatus,
    type ChatReplyUpdate,
    type ChatTimelineState,
    type ChatTurn,
    type ChatTurnProgressStep,
    clearTimelineTurn,
    completeTimelineTurn,
    emptyTimelineState,
    failTimelineTurn,
    startTimelineTurn,
    updateTimelineReply,
    updateTimelineTurnProgress,
} from './chat-timeline-state.ts';

interface TimelineActionsValue {
    clearTurn: (input: { chatId: string; runId?: string }) => void;
    completeTurn: (input: { chatId: string; completedAt: string; turn: ChatTurn }) => void;
    failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
    setLog: (chatId: string, log: ChatLogOutput | undefined) => void;
    setReply: (
        chatId: string,
        activeReply: ChatStatusListOutput['chats'][number]['activeReply'] | null
    ) => void;
    setStatus: (chatId: string, status: ChatActiveStatus | null) => void;
    startTurn: (turn: ChatTurn) => void;
    updateReply: (update: ChatReplyUpdate) => void;
    updateTurnProgress: (input: {
        chatId: string;
        receivedAt: string;
        step: ChatTurnProgressStep;
        turn: ChatTurn;
    }) => void;
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

    const setReply = React.useCallback(
        (
            chatId: string,
            activeReply: ChatStatusListOutput['chats'][number]['activeReply'] | null
        ) => {
            setTimelineStates((current) =>
                updateTimelineState(current, chatId, (state) =>
                    applyReplySnapshot(state, activeReply)
                )
            );
        },
        []
    );

    const setStatus = React.useCallback((chatId: string, status: ChatActiveStatus | null) => {
        setTimelineStates((current) =>
            updateTimelineState(current, chatId, (state) => applyStatusSnapshot(state, status))
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

    const updateTurnProgress = React.useCallback(
        (input: {
            chatId: string;
            receivedAt: string;
            step: ChatTurnProgressStep;
            turn: ChatTurn;
        }) => {
            setTimelineStates((current) =>
                updateTimelineState(current, input.chatId, (state) =>
                    updateTimelineTurnProgress(state, {
                        receivedAt: input.receivedAt,
                        step: input.step,
                        turn: input.turn,
                    })
                )
            );
        },
        []
    );

    const actions = React.useMemo<TimelineActionsValue>(
        () => ({
            clearTurn,
            completeTurn,
            failTurn,
            setLog,
            setReply,
            setStatus,
            startTurn,
            updateTurnProgress,
            updateReply,
        }),
        [
            clearTurn,
            completeTurn,
            failTurn,
            setLog,
            setReply,
            setStatus,
            startTurn,
            updateReply,
            updateTurnProgress,
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
