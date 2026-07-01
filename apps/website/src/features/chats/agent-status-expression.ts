import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { AgentEyeEmotion } from './agent-eyes-config.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';

export type AgentStatusChatRow = TranscriptRow;

export function resolveAgentStatusExpression(input: {
    activeReply: ChatActiveReply | null;
    failedTurn?: ChatTurnFailure | null;
    rows: AgentStatusChatRow[];
}): AgentEyeEmotion {
    if (input.failedTurn) {
        return 'sweat';
    }

    if (!input.activeReply) {
        return 'idle';
    }

    const latestProgress = findLatestTurnProgressRow(input.rows, input.activeReply);

    if (latestProgress) {
        return expressionForRow(latestProgress);
    }

    return (input.activeReply.text ?? '').trim().length > 0 &&
        input.activeReply.isThinking === false
        ? 'happy'
        : 'thinking';
}

export function getAgentStatusLabel(emotion: AgentEyeEmotion) {
    switch (emotion) {
        case 'confused':
            return 'Agent needs input';
        case 'curious':
        case 'angry':
            return 'Agent is working';
        case 'happy':
        case 'laughing':
            return 'Agent is replying';
        case 'sweat':
            return 'Agent needs attention';
        case 'thinking':
            return 'Agent is thinking';
        default:
            return 'Agent idle';
    }
}

function findLatestTurnProgressRow(rows: AgentStatusChatRow[], activeReply: ChatActiveReply) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (!rowBelongsToActiveRun(row, activeReply.runId)) {
            continue;
        }

        if (isFailedProgressRow(row) || isActiveProgressRow(row) || isAssistantProgressRow(row)) {
            return row;
        }
    }

    return null;
}

function expressionForRow(row: AgentStatusChatRow): AgentEyeEmotion {
    if (isFailedProgressRow(row)) {
        return 'sweat';
    }

    if (row.kind === 'tool') {
        const name = row.toolCall.name.trim().toLowerCase();

        if (name === 'clarify' || (row.clarification && !row.clarification.disposition)) {
            return 'confused';
        }

        return isCommandToolName(name) || isEditToolName(name) ? 'angry' : 'curious';
    }

    if (row.kind === 'worker') {
        return 'curious';
    }

    if (row.kind === 'message') {
        return 'happy';
    }

    return row.kind === 'system' && row.systemKind === 'thinking' ? 'thinking' : 'curious';
}

function rowBelongsToActiveRun(row: AgentStatusChatRow, runId: string) {
    if (row.id.includes(runId)) {
        return true;
    }

    if (row.kind === 'worker' && row.worker.runId === runId) {
        return true;
    }

    if (row.kind !== 'message') {
        return false;
    }

    const runtime = row.message.metadata?.runtime;

    return (
        runtime !== null &&
        typeof runtime === 'object' &&
        !Array.isArray(runtime) &&
        (runtime as Record<string, unknown>).runId === runId
    );
}

function isActiveProgressRow(row: AgentStatusChatRow) {
    if (row.kind === 'tool' || row.kind === 'worker') {
        return !row.completedAt;
    }

    return false;
}

function isFailedProgressRow(row: AgentStatusChatRow) {
    if (row.kind === 'tool') {
        return row.toolCall.status === 'error';
    }

    if (row.kind !== 'worker') {
        return false;
    }

    return row.worker.status === 'failed' || row.worker.status === 'timed_out';
}

function isAssistantProgressRow(row: AgentStatusChatRow) {
    return (
        row.kind === 'message' ||
        (row.kind === 'system' &&
            (row.systemKind === 'thinking' || row.systemKind === 'runtimeNotice'))
    );
}

function isCommandToolName(name: string) {
    return ['bash', 'command', 'exec', 'process', 'shell', 'terminal', 'zsh'].some((candidate) =>
        name.includes(candidate)
    );
}

function isEditToolName(name: string) {
    return ['apply_patch', 'edit', 'file_edit', 'file_write', 'patch', 'replace', 'write'].some(
        (candidate) => name.includes(candidate)
    );
}
