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
        | 'widget'
        | 'tool'
        | 'worker';
    label: string;
    messagePhase?: 'commentary' | 'final_answer';
    status: 'active' | 'completed' | 'failed';
    toolCallId?: string | null;
    toolName?: string | null;
    widget?: {
        component: string | null;
        fallbackText: string;
        id: string;
        props?: unknown | null;
        target: string | null;
        validationError: string | null;
    };
}

// Live turn state is plural: each agent seat can run one turn at a time, so a
// multi-agent chat legitimately carries several concurrent runs. Collections
// are keyed by runId and ordered by startedAt.
export interface ChatTimelineState {
    activeReplies: ChatActiveReply[];
    activeTurns: ChatTurn[];
    failedTurns: ChatTurnFailure[];
    historyLoaded: boolean;
    timeline: ChatTimeline;
    totalMessages: number;
    // Live execution evidence per active run, in arrival order. Feeds the
    // turn drawer while a turn streams; durable turns query
    // chat.turn.evidence instead. Cleared when the run ends.
    turnEvidence: Record<string, ChatTimeline>;
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
