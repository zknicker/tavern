import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    type ChatTimelineState,
    emptyTimelineState,
} from './chat-timeline-state.ts';

interface TimelineActionsValue {
    setLog: (chatId: string, log: ChatLogOutput | undefined) => void;
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

    const setLog = React.useCallback((chatId: string, log: ChatLogOutput | undefined) => {
        const current = timelineStatesRef.current;
        const next = updateTimelineState(current, chatId, (state) => applyLogSnapshot(state, log));

        if (next === current) {
            return;
        }

        timelineStatesRef.current = next;
        setTimelineStates(next);
    }, []);

    const actions = React.useMemo<TimelineActionsValue>(() => ({ setLog }), [setLog]);

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
