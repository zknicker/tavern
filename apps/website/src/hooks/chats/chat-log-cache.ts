import type { ChatLogOutput } from '../../lib/trpc.tsx';
import type { ChatTurn, ChatTurnProgressStep } from './chat-timeline-state.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ChatLogPage = NonNullable<ChatLogOutput>;
type ChatLogInput = Omit<ChatLogPage, 'activeReply' | 'failedTurn'> &
    Partial<Pick<ChatLogPage, 'activeReply' | 'failedTurn'>>;
type MessageRow = Extract<ChatLogRow, { kind: 'message' }>;
type ToolRow = Extract<ChatLogRow, { kind: 'tool' }>;
type ThinkingRow = Extract<ChatLogRow, { kind: 'system'; systemKind: 'thinking' }>;
type NoticeRow = Extract<ChatLogRow, { kind: 'system'; systemKind: 'runtimeNotice' }>;
type RichResponseRow = Extract<ChatLogRow, { kind: 'rich_response' }>;
type WorkerRow = Extract<ChatLogRow, { kind: 'worker' }>;
type ProgressRow = MessageRow | NoticeRow | ThinkingRow | ToolRow | RichResponseRow | WorkerRow;

export const defaultLiveChatLogLimit = 100;

export function patchChatLogWithProgress(
    log: ChatLogInput | undefined,
    input: {
        step: ChatTurnProgressStep;
        timestamp: string;
        turn: ChatTurn;
    }
): ChatLogOutput | undefined {
    if (!log) {
        return undefined;
    }

    const sourceLog = normalizeChatLog(log);

    const rows = upsertProgressRows(sourceLog.rows, progressStepToChatRows(input));

    // Live progress only grows the loaded page. Progress rows are never
    // durable chat messages, so the message total is untouched.
    return {
        ...sourceLog,
        rows: rows.sort(compareChatLogRows),
    };
}

export function patchChatLogWithSteerNotice(
    log: ChatLogInput | undefined,
    input: {
        content: string;
        runId: string;
        timestamp: string;
    }
): ChatLogOutput | undefined {
    if (!log) {
        return undefined;
    }

    const sourceLog = normalizeChatLog(log);
    const rows = upsertRows(sourceLog.rows, steerNoticeToChatRows(input));

    return {
        ...sourceLog,
        rows: rows.sort(compareChatLogRows),
    };
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReply: log.activeReply ?? null,
        failedTurn: log.failedTurn ?? null,
        limit: log.limit,
        nextBeforeSequence: log.nextBeforeSequence,
        rows: log.rows,
        totalMessages: log.totalMessages,
    };
}

function steerNoticeToChatRows(input: {
    content: string;
    runId: string;
    timestamp: string;
}): MessageRow[] {
    const content = input.content.trim();

    if (!content) {
        return [];
    }

    const text = `Steered active turn: ${content}`;
    const messageId = `${steerNoticeActivityId(input.runId)}_message`;

    return [
        {
            actor: { id: 'usr_tavern', kind: 'participant' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: messageId,
            isFirstInGroup: true,
            kind: 'message',
            message: {
                actor: { id: 'usr_tavern', kind: 'participant' },
                content,
                id: messageId,
                metadata: {
                    runtime: {
                        notice: {
                            detail: content,
                            id: 'runtime_notice_steered',
                            kind: 'status',
                            sessionId: null,
                            text,
                            title: 'Steered active turn',
                        },
                        runId: input.runId,
                        source: 'hermes',
                    },
                },
                sender: 'You',
                senderType: 'user',
                sourceSessionId: null,
                sourceSessionKey: '',
                tavernAgentId: null,
                timestamp: input.timestamp,
            },
            responseId: undefined,
        },
    ];
}

function upsertRows(current: readonly ChatLogRow[], nextRows: readonly ProgressRow[]) {
    const rows = [...current];

    for (const row of nextRows) {
        const existingIndex = rows.findIndex((entry) => entry.id === row.id);

        if (existingIndex === -1) {
            rows.push(row);
            continue;
        }

        rows[existingIndex] = row;
    }

    return rows;
}

function upsertProgressRows(current: readonly ChatLogRow[], nextRows: readonly ProgressRow[]) {
    let rows = [...current];

    for (const row of nextRows) {
        const existingIndex = rows.findIndex((entry) => entry.id === row.id);

        rows =
            existingIndex === -1
                ? [...rows, row]
                : rows.map((entry, index) =>
                      index === existingIndex ? mergeProgressRows(entry, row) : entry
                  );
    }

    return rows;
}

function progressStepToNoticeRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): NoticeRow {
    return {
        id: progressActivityId(input.turn.runId, input.step.id),
        kind: 'system',
        runtimeNotice: {
            compactionCount: null,
            detail: null,
            kind: 'status',
            sessionId: null,
            text: input.step.detail ?? input.step.label,
            title: input.step.label,
        },
        systemKind: 'runtimeNotice',
        timestamp: input.timestamp,
    };
}

function progressStepToChatRows(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): ProgressRow[] {
    if (input.step.kind === 'notice' && input.step.id.endsWith('runtime_notice_steered')) {
        return steerNoticeToChatRows({
            content: input.step.detail ?? '',
            runId: input.turn.runId,
            timestamp: input.timestamp,
        });
    }

    if (input.step.kind === 'message') {
        return [progressStepToMessageRow(input)];
    }

    if (input.step.kind === 'reasoning' || input.step.kind === 'plan') {
        return [progressStepToThinkingRow(input)];
    }

    if (input.step.kind === 'notice') {
        return [progressStepToNoticeRow(input)];
    }

    if (input.step.kind === 'worker') {
        return [progressStepToWorkerRow(input)];
    }

    if (input.step.kind === 'rich_response') {
        return [progressStepToRichResponseRow(input)];
    }

    return [progressStepToToolRow(input)];
}

function progressStepToMessageRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): MessageRow {
    const id = progressActivityId(input.turn.runId, input.step.id);
    const content = input.step.detail?.trim() || input.step.label;
    const actor = {
        id: input.turn.agentId,
        kind: 'agent' as const,
    };

    return {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor,
            content,
            id,
            metadata: {
                runtime: {
                    runId: input.turn.runId,
                    sessionKey: input.turn.sessionKey,
                    source: 'hermes',
                },
            },
            sender: input.turn.agentId,
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: input.turn.sessionKey,
            tavernAgentId: input.turn.agentId,
            timestamp: input.timestamp,
        },
    };
}

function progressStepToThinkingRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): ThinkingRow {
    return {
        id: progressActivityId(input.turn.runId, input.step.id),
        kind: 'system',
        systemKind: 'thinking',
        thinking: {
            id: progressActivityId(input.turn.runId, input.step.id),
            messageId: input.turn.runId,
            sender: input.turn.agentId,
            text: input.step.detail ?? input.step.label,
            timestamp: input.timestamp,
        },
        timestamp: input.timestamp,
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
        clarification: normalizeProgressClarification(input.step.clarification),
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

function progressStepToWorkerRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): WorkerRow {
    const id = progressActivityId(input.turn.runId, input.step.id);
    const isRunning = input.step.status === 'active';

    return {
        actor: { id: input.turn.agentId, kind: 'agent' },
        completedAt: isRunning ? null : input.timestamp,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'worker',
        sessionKey: input.turn.sessionKey,
        startedAt: input.timestamp,
        worker: {
            agentId: input.turn.agentId,
            agentName: input.turn.agentId,
            chatTitle: null,
            childSessionKey: null,
            cleanupAfter: null,
            createdAt: input.timestamp,
            deliveryStatus: null,
            description: null,
            detail: input.step.detail ?? null,
            endedAt: isRunning ? null : input.timestamp,
            error: null,
            executionMode: 'unknown',
            id,
            kind: 'subagent',
            lastEventAt: input.timestamp,
            notifyPolicy: null,
            parentWorkerId: null,
            progressSummary: input.step.detail ?? null,
            requesterSessionKey: input.turn.sessionKey,
            runId: input.turn.runId,
            sessionKey: null,
            source: 'agentRuntime',
            sourceFlowId: null,
            sourceId: id,
            startedAt: input.timestamp,
            status: input.step.status === 'failed' ? 'failed' : isRunning ? 'running' : 'succeeded',
            syncedAt: input.timestamp,
            terminalSummary: null,
            title: input.step.label,
        },
    };
}

function progressStepToRichResponseRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): RichResponseRow {
    const id = progressActivityId(input.turn.runId, input.step.id);
    const richResponse = input.step.richResponse ?? {
        component: null,
        fallbackText: input.step.detail?.trim() || input.step.label,
        id,
        props: null,
        target: null,
        validationError: 'Rich Response unavailable.',
    };

    return {
        actor: { id: input.turn.agentId, kind: 'agent' },
        completedAt: input.step.status === 'active' ? null : input.timestamp,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'rich_response',
        richResponse: {
            ...richResponse,
            id,
            props: richResponse.props ?? null,
        },
        sessionKey: input.turn.sessionKey,
        startedAt: input.timestamp,
    };
}

function mergeProgressRows(existing: ChatLogRow, next: ProgressRow) {
    if (existing.kind === 'message' && next.kind === 'message') {
        return mergeMessageRows(existing, next);
    }

    if (existing.kind === 'tool' && next.kind === 'tool') {
        return mergeToolRows(existing, next);
    }

    if (existing.kind === 'worker' && next.kind === 'worker') {
        return mergeWorkerRows(existing, next);
    }

    if (existing.kind === 'rich_response' && next.kind === 'rich_response') {
        return mergeRichResponseRows(existing, next);
    }

    if (
        existing.kind === 'system' &&
        existing.systemKind === 'thinking' &&
        next.kind === 'system' &&
        next.systemKind === 'thinking'
    ) {
        return mergeThinkingRows(existing, next);
    }

    return next;
}

function mergeMessageRows(existing: MessageRow, next: MessageRow): MessageRow {
    return {
        ...next,
        connectsToNext: existing.connectsToNext,
        connectsToPrevious: existing.connectsToPrevious,
        isFirstInGroup: existing.isFirstInGroup,
        message: {
            ...next.message,
            timestamp: existing.message.timestamp || next.message.timestamp,
        },
    };
}

function mergeThinkingRows(existing: ThinkingRow, next: ThinkingRow): ThinkingRow {
    return {
        ...next,
        thinking: {
            ...next.thinking,
            timestamp: existing.thinking.timestamp ?? next.thinking.timestamp,
        },
        timestamp: existing.timestamp ?? next.timestamp,
    };
}

function mergeWorkerRows(existing: WorkerRow, next: WorkerRow): WorkerRow {
    return {
        ...next,
        completedAt: next.completedAt ?? existing.completedAt,
        startedAt: existing.startedAt ?? next.startedAt,
        worker: {
            ...next.worker,
            createdAt: existing.worker.createdAt,
            detail: next.worker.detail ?? existing.worker.detail,
            progressSummary: next.worker.progressSummary ?? existing.worker.progressSummary,
            startedAt: existing.worker.startedAt ?? next.worker.startedAt,
        },
    };
}

function mergeRichResponseRows(existing: RichResponseRow, next: RichResponseRow): RichResponseRow {
    return {
        ...next,
        completedAt: next.completedAt ?? existing.completedAt,
        startedAt: existing.startedAt ?? next.startedAt,
    };
}

function mergeToolRows(existing: ToolRow, next: ToolRow): ToolRow {
    return {
        ...next,
        clarification: next.clarification ?? existing.clarification ?? null,
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

function normalizeProgressClarification(step: ChatTurnProgressStep['clarification']) {
    if (!step) {
        return null;
    }

    return {
        answer: step.answer ?? null,
        choices: step.choices,
        deadlineAt: step.deadlineAt ?? null,
        disposition: step.disposition ?? null,
        question: step.question,
        requestId: step.requestId,
    };
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
    if (step.toolName?.trim().toLowerCase() === 'clarify') {
        return step.clarification?.question ?? step.detail?.trim() ?? stripToolVerb(step.label);
    }

    const detail = step.detail?.trim();

    if (
        step.kind === 'approval' ||
        step.kind === 'message' ||
        step.kind === 'reasoning' ||
        step.kind === 'plan'
    ) {
        return detail ?? stripToolVerb(step.label);
    }

    const stripped = stripToolVerb(step.label);
    const toolName = step.toolName?.trim().toLowerCase();

    // A label that is just the tool's internal name carries no intent; the
    // detail (command or argument preview) is the real target.
    if (detail && stripped && toolName && stripped.toLowerCase() === toolName) {
        return detail;
    }

    return stripped ?? detail ?? step.label;
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

function steerNoticeActivityId(runId: string) {
    return activityId(`${runId}_runtime_notice_steered`);
}

function stripActivityPrefix(id: string) {
    return id.startsWith('act_') ? id.slice('act_'.length) : id;
}

function activityId(id: string) {
    return id.startsWith('act_') ? id : `act_${id.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}

function compareChatLogRows(left: ChatLogRow, right: ChatLogRow) {
    const timestampDelta = rowTimestamp(left) - rowTimestamp(right);

    return timestampDelta || rowSortRank(left) - rowSortRank(right);
}

function rowTimestamp(row: ChatLogRow) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'tool' || row.kind === 'rich_response'
              ? (row.startedAt ?? row.completedAt)
              : row.kind === 'worker'
                ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt)
                : row.timestamp;
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function rowSortRank(row: ChatLogRow) {
    if (row.kind === 'message') {
        if (isActivityMessageRow(row)) {
            return 1;
        }
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}

function isActivityMessageRow(row: Extract<ChatLogRow, { kind: 'message' }>) {
    return row.id.startsWith('act_');
}
