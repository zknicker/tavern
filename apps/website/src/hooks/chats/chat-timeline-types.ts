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
    // Peer-evaluation turns stay quiet until reply text streams
    // (specs/addressing.md).
    trigger?: 'evaluation';
}
export type ChatTimelineMessageRow = Extract<ChatTimeline[number], { kind: 'message' }>;

// Live turn state is plural: each agent seat can run one turn at a time, so a
// multi-agent chat legitimately carries several concurrent runs. Collections
// are keyed by runId and ordered by startedAt.
export interface ChatTimelineState {
    activeReplies: ChatActiveReply[];
    activeTurns: ChatTurn[];
    historyLoaded: boolean;
    // Runs this client saw end (completed, cancelled, or failed), newest
    // last. A log snapshot served before a run settled can land after its
    // terminal event; these ids keep such stale snapshots from resurrecting
    // a dead turn's thinking row.
    terminalRunIds: readonly string[];
    timeline: ChatTimeline;
    totalMessages: number;
    // Live execution evidence per active run, in arrival order. Feeds the
    // turn drawer while a turn streams; durable turns query
    // chat.turn.evidence instead. Cleared when the run ends.
    turnEvidence: Record<string, ChatTimeline>;
}

export interface ChatTurn {
    agentId: string;
    chatId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    trigger?: 'evaluation';
}
