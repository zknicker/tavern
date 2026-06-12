import type { ChatLogOutput } from '../../lib/trpc.tsx';

export type ChatTimeline = NonNullable<ChatLogOutput>['rows'];
export interface ChatActiveReply {
    agentId: string;
    completedAt?: string | null;
    isThinking?: boolean;
    runId: string;
    sessionKey: string;
    startedAt: string;
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
        | 'approval'
        | 'artifact'
        | 'command'
        | 'message'
        | 'notice'
        | 'plan'
        | 'reasoning'
        | 'tool'
        | 'worker';
    label: string;
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
