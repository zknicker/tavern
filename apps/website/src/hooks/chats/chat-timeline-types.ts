import type { ChatLogOutput } from '../../lib/trpc.tsx';

export type ChatTimeline = NonNullable<ChatLogOutput>['rows'];
export interface ChatActiveReply {
    agentId: string;
    completedAt?: string | null;
    isThinking?: boolean;
    runId: string;
    sessionKey: string;
    startedAt: string;
    statusSequence?: number | null;
    text?: string;
}
export type ChatTimelineMessageRow = Extract<ChatTimeline[number], { kind: 'message' }>;

export interface ChatTurnProgressStep {
    clarification?: {
        answer?: string | null;
        choices: string[];
        deadlineAt?: string | null;
        disposition?: 'answered' | 'skipped' | 'timeout' | null;
        question: string;
        requestId: string;
    };
    detail?: string | null;
    id: string;
    kind:
        | 'artifact'
        | 'command'
        | 'message'
        | 'notice'
        | 'reasoning'
        | 'rich_response'
        | 'tool'
        | 'worker';
    label: string;
    messagePhase?: 'commentary' | 'final_answer';
    richResponse?: {
        component: string | null;
        fallbackText: string;
        id: string;
        props?: unknown | null;
        target: string | null;
        validationError: string | null;
    };
    status: 'active' | 'completed' | 'failed';
    toolCallId?: string | null;
    toolName?: string | null;
}

export interface ChatTimelineState {
    activeReply: ChatActiveReply | null;
    activeTurn: ChatTurn | null;
    failedTurn: ChatTurnFailure | null;
    historyLoaded: boolean;
    timeline: ChatTimeline;
    totalMessages: number;
}

export interface ChatTurnFailure {
    error: string;
    responseId: string | null;
    turn: ChatTurn;
}

export interface ChatTurn {
    agentId: string;
    chatId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
}

export interface ChatReplyUpdate {
    delta?: string;
    isThinking?: boolean;
    replace?: boolean;
    text: string;
    timestamp?: string;
    turn: ChatTurn;
}

export interface ChatTurnStatusUpdate {
    sequence: number;
    timestamp?: string;
    turn: ChatTurn;
}
