import type { ChatLogOutput } from '../../lib/trpc.tsx';
import type { ChatTurn, ChatTurnProgressStep } from './chat-timeline-state.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ToolRow = Extract<ChatLogRow, { kind: 'tool' }>;

export function patchChatLogWithProgress(
    log: ChatLogOutput | undefined,
    input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }
): ChatLogOutput | undefined {
    if (!log) {
        return log;
    }

    const row = progressStepToToolRow(input);
    const existingIndex = log.rows.findIndex((entry) => entry.id === row.id);
    const rows =
        existingIndex === -1
            ? [...log.rows, row]
            : log.rows.map((entry, index) =>
                  index === existingIndex ? mergeToolRows(entry as ToolRow, row) : entry
              );
    const sortedRows = rows.sort(compareChatLogRows);
    const nextRows = trimRows(sortedRows, log.limit);
    const total = existingIndex === -1 ? log.total + 1 : log.total;

    return {
        ...log,
        rows: nextRows,
        total,
    };
}

function progressStepToToolRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): ToolRow {
    const completedAt = input.step.status === 'active' ? null : input.timestamp;
    const name = input.step.toolName ?? toolNameForStep(input.step);
    const target = toolTarget(input.step);

    return {
        actor: {
            id: input.turn.agentId,
            kind: 'agent',
        },
        completedAt,
        connectsToNext: false,
        connectsToPrevious: false,
        id: progressActivityId(input.turn.runId, input.step.id),
        isFirstInGroup: true,
        kind: 'tool',
        sessionKey: input.turn.sessionKey,
        spawnedRelationships: [],
        startedAt: input.timestamp,
        toolCall: {
            callId: input.step.toolCallId ?? likelyToolCallId(input.step.id),
            facts: toolFacts(input.step, target),
            label: target,
            name,
            status: input.step.status === 'failed' ? 'error' : null,
            summaryParts: target ? [target] : [],
        },
    };
}

function mergeToolRows(existing: ToolRow, next: ToolRow): ToolRow {
    return {
        ...next,
        completedAt: next.completedAt ?? existing.completedAt,
        startedAt: existing.startedAt ?? next.startedAt,
        toolCall: {
            ...next.toolCall,
            callId: next.toolCall.callId ?? existing.toolCall.callId,
            facts: next.toolCall.facts.length > 0 ? next.toolCall.facts : existing.toolCall.facts,
            label: next.toolCall.label ?? existing.toolCall.label,
            name: next.toolCall.name || existing.toolCall.name,
            status: next.toolCall.status ?? existing.toolCall.status,
            summaryParts:
                next.toolCall.summaryParts.length > 0
                    ? next.toolCall.summaryParts
                    : existing.toolCall.summaryParts,
        },
    };
}

function toolFacts(
    step: ChatTurnProgressStep,
    target: string | null
): ToolRow['toolCall']['facts'] {
    if (!(target && isShellStep(step))) {
        return [];
    }

    return [
        {
            label: 'Command',
            tone: 'default',
            value: target,
        },
    ];
}

function isShellStep(step: ChatTurnProgressStep) {
    const name = step.toolName?.trim().toLowerCase() ?? '';

    return step.kind === 'command' || ['bash', 'command', 'exec', 'shell', 'zsh'].includes(name);
}

function toolNameForStep(step: ChatTurnProgressStep) {
    if (step.kind === 'message') {
        return 'message';
    }
    if (step.kind === 'reasoning' || step.kind === 'plan') {
        return 'reasoning';
    }
    if (step.kind === 'command') {
        return 'command';
    }
    return step.kind;
}

function toolTarget(step: ChatTurnProgressStep) {
    const detail = step.detail?.trim();

    if (step.kind === 'message' || step.kind === 'reasoning' || step.kind === 'plan') {
        return detail ?? stripToolVerb(step.label);
    }

    return stripToolVerb(step.label) ?? detail ?? step.label;
}

function stripToolVerb(label: string) {
    const stripped = label.trim().replace(/^(?:used|using|read|edited|browsed)\s+/iu, '');

    return stripped.length > 0 ? stripped : null;
}

function likelyToolCallId(id: string) {
    return id.startsWith('call_') || id.startsWith('tool-call-') ? id : null;
}

function progressActivityId(runId: string, stepId: string) {
    const activity = stripActivityPrefix(stepId);
    const scopedActivity = activity.startsWith(`${runId}_`) ? activity : `${runId}_${activity}`;

    return activityId(scopedActivity);
}

function stripActivityPrefix(id: string) {
    return id.startsWith('act_') ? id.slice('act_'.length) : id;
}

function activityId(id: string) {
    return id.startsWith('act_') ? id : `act_${id.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}

function trimRows(rows: ChatLogRow[], limit: number) {
    return rows.length > limit ? rows.slice(rows.length - limit) : rows;
}

function compareChatLogRows(left: ChatLogRow, right: ChatLogRow) {
    const timestampDelta = rowTimestamp(left) - rowTimestamp(right);

    return timestampDelta || rowSortRank(left) - rowSortRank(right);
}

function rowTimestamp(row: ChatLogRow) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'tool'
              ? (row.startedAt ?? row.completedAt)
              : row.kind === 'worker'
                ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt)
                : row.timestamp;
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function rowSortRank(row: ChatLogRow) {
    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}
