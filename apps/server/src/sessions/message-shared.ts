import type { GlobalSession } from './contracts.ts';

export interface ChatHistoryMessage {
    _meta?: {
        id?: string | null;
        seq?: number | null;
    } | null;
    api?: string | null;
    content?: string | null;
    createdAt?: number | string | null;
    errorMessage?: string | null;
    id?: string | null;
    isError?: boolean | null;
    model?: string | null;
    parts?: unknown;
    provider?: string | null;
    role?: string | null;
    sender?: string | null;
    senderLabel?: string | null;
    stopReason?: string | null;
    text?: string | null;
    timestamp?: number | string | null;
    toolCallId?: string | null;
    toolName?: string | null;
    usage?: unknown;
}

export interface LiveSession {
    abortedLastRun?: boolean | null;
    channel?: string | null;
    childSessions?: string[] | null;
    deliveryContext?: unknown;
    derivedTitle?: string | null;
    displayName?: string | null;
    endedAt?: number | null;
    key: string;
    kind?: string | null;
    label?: string | null;
    lastMessagePreview?: string | null;
    messageCount?: number | null;
    messages?: LiveSessionMessage[] | null;
    model?: string | null;
    parentSessionKey?: string | null;
    reasoningLevel?: string | null;
    sessionId: string;
    spawnedBy?: string | null;
    startedAt?: number | null;
    status?: string | null;
    thinkingLevel?: string | null;
    updatedAt: number | string;
}

export interface LiveSessionMessage extends ChatHistoryMessage {
    author?: string | null;
    label?: string | null;
}

const agentKeyPattern = /^agent:([^:]+)/;

export const sessionHistoryLimit = 1000;

export function deriveAgentId(key: string) {
    const match = agentKeyPattern.exec(key);
    return match?.[1] ?? key.split(':')[1] ?? key;
}

export function normalizeSessionState(session: LiveSession): GlobalSession['state'] {
    if (session.abortedLastRun) {
        return 'failed';
    }

    if (session.kind === 'unknown') {
        return 'idle';
    }

    return 'running';
}
