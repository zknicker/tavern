import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';

export type ChatTimeline = NonNullable<ChatLogOutput>['rows'];
export type ChatActiveReply = ChatStatusListOutput['chats'][number]['activeReply'];
export type ChatActiveStatus = ChatStatusListOutput['chats'][number];
export type ChatTimelineMessageRow = Extract<ChatTimeline[number], { kind: 'message' }>;

export interface ChatTurnProgressStep {
    detail?: string | null;
    id: string;
    kind: 'approval' | 'artifact' | 'command' | 'message' | 'plan' | 'reasoning' | 'tool';
    label: string;
    status: 'active' | 'completed' | 'failed';
    toolCallId?: string | null;
    toolName?: string | null;
}

export const initialPlanningStep: ChatTurnProgressStep = {
    detail: null,
    id: 'planning',
    kind: 'plan',
    label: 'Planning',
    status: 'active',
};

export interface ChatTimelineState {
    activeReply: ChatActiveReply | null;
    activeReplyProgressStartedAt: string | null;
    activeReplySteps: ChatTurnProgressStep[];
    completedProgress: ChatCompletedProgress | null;
    failedTurn: ChatTurnFailure | null;
    historyLoaded: boolean;
    timeline: ChatTimeline;
    totalRows: number;
}

export interface ChatTurnFailure {
    error: string;
    turn: ChatTurn;
}

export interface ChatTurn {
    agentId: string;
    chatId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
}

export interface ChatCompletedProgress {
    completedAt: string;
    reply: ChatActiveReply;
    startedAt: string;
    steps: ChatTurnProgressStep[];
}

export interface ChatReplyUpdate {
    delta?: string;
    isThinking?: boolean;
    replace?: boolean;
    text: string;
    turn: ChatTurn;
}
