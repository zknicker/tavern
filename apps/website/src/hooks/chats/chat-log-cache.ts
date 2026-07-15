import type { ChatLogOutput } from '../../lib/trpc.tsx';
import type { ChatTurn, ChatTurnProgressStep } from './chat-timeline-state.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ChatLogPage = NonNullable<ChatLogOutput>;
type ChatLogInput = Omit<ChatLogPage, 'activeReplies' | 'failedTurns' | 'settledRunIds'> &
    Partial<Pick<ChatLogPage, 'activeReplies' | 'failedTurns' | 'settledRunIds'>>;
type MessageRow = Extract<ChatLogRow, { kind: 'message' }>;
type ToolRow = Extract<ChatLogRow, { kind: 'tool' }>;
type ThinkingRow = Extract<ChatLogRow, { kind: 'system'; systemKind: 'thinking' }>;
type NoticeRow = Extract<ChatLogRow, { kind: 'system'; systemKind: 'runtimeNotice' }>;
type WidgetRow = Extract<ChatLogRow, { kind: 'widget' }>;
type WorkerRow = Extract<ChatLogRow, { kind: 'worker' }>;
type ProgressRow = MessageRow | NoticeRow | ThinkingRow | ToolRow | WidgetRow | WorkerRow;

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

    // The timeline carries conversation units only (specs/chat-timeline.md):
    // widgets, runtime notices — and the turn's post, which narration steps
    // create or edit in place. Tool, reasoning, and worker steps are turn
    // evidence and never become rows.
    const conversationRows = progressStepToChatRows(input).filter(isConversationProgressRow);
    const postText = input.step.kind === 'message' ? input.step.detail?.trim() : undefined;

    if (conversationRows.length === 0 && !postText) {
        return undefined;
    }

    const sourceLog = normalizeChatLog(log);
    let rows = upsertProgressRows(sourceLog.rows, conversationRows);

    if (postText) {
        rows = upsertPostRow(rows, {
            content: postText,
            timestamp: input.timestamp,
            turn: input.turn,
        });
    }

    // Live progress only grows the loaded page. Progress rows are never
    // durable chat messages, so the message total is untouched.
    return {
        ...sourceLog,
        rows: rows.sort(compareChatLogRows),
    };
}

// The turn's post id — must match the runtime's streaming message id.
export function postMessageIdForRun(runId: string) {
    return `msg_${runId.replace(/[^A-Za-z0-9_-]/gu, '_')}_assistant`;
}

// createPost/editPost (specs/chat-timeline.md): the optimistic twin of the
// runtime's streaming message. Created at the timeline's end on the turn's
// first visible content, edited in place after; the durable row merges by id.
export function upsertPostRow(
    current: readonly ChatLogRow[],
    input: { content: string; timestamp: string; turn: ChatTurn }
): ChatLogRow[] {
    const id = postMessageIdForRun(input.turn.runId);
    const existingIndex = current.findIndex((row) => row.id === id);

    if (existingIndex >= 0) {
        return current.map((row, index) =>
            index === existingIndex && row.kind === 'message'
                ? { ...row, message: { ...row.message, content: input.content } }
                : row
        );
    }

    const actor = { id: input.turn.agentId, kind: 'agent' as const };

    return [
        ...current,
        {
            actor,
            connectsToNext: false,
            connectsToPrevious: false,
            id,
            isFirstInGroup: true,
            kind: 'message',
            runId: input.turn.runId,
            message: {
                actor,
                content: input.content,
                id,
                metadata: {
                    runtime: {
                        runId: input.turn.runId,
                        sessionKey: input.turn.sessionKey,
                        source: 'agent-engine',
                        streaming: true,
                    },
                },
                sender: input.turn.agentId,
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: input.turn.sessionKey,
                tavernAgentId: input.turn.agentId,
                timestamp: input.timestamp,
            },
        },
    ];
}

// Streamed reply text edits the existing post in place; before the post
// exists the live reply overlay carries the text.
export function patchChatLogWithPostText(
    log: ChatLogInput | undefined,
    input: { runId: string; text: string }
): ChatLogOutput | undefined {
    if (!log) {
        return undefined;
    }

    const id = postMessageIdForRun(input.runId);
    const content = input.text.trim();
    const existing = log.rows.find((row) => row.id === id);

    if (!(content && existing && existing.kind === 'message')) {
        return undefined;
    }

    if (existing.message.content === content) {
        return undefined;
    }

    const sourceLog = normalizeChatLog(log);

    return {
        ...sourceLog,
        rows: sourceLog.rows.map((row) =>
            row.id === id && row.kind === 'message'
                ? { ...row, message: { ...row.message, content } }
                : row
        ),
    };
}

function isConversationProgressRow(row: ProgressRow) {
    if (row.kind === 'widget') {
        return true;
    }
    if (row.kind === 'system') {
        return row.systemKind === 'runtimeNotice';
    }
    // Clarifications are conversational questions, not execution evidence.
    if (row.kind === 'tool') {
        return Boolean(row.clarification);
    }
    // Agent narration is evidence; the post path owns visible message text.
    return false;
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReplies: log.activeReplies ?? [],
        failedTurns: log.failedTurns ?? [],
        limit: log.limit,
        nextBeforeSequence: log.nextBeforeSequence,
        rows: log.rows,
        settledRunIds: log.settledRunIds ?? [],
        totalMessages: log.totalMessages,
    };
}

export function upsertProgressRows(
    current: readonly ChatLogRow[],
    nextRows: readonly ProgressRow[]
) {
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
            agentId: input.turn.agentId,
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

export function progressStepToChatRows(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): ProgressRow[] {
    if (input.step.kind === 'message') {
        return [progressStepToMessageRow(input)];
    }

    if (input.step.kind === 'reasoning') {
        return [progressStepToThinkingRow(input)];
    }

    if (input.step.kind === 'notice') {
        return [progressStepToNoticeRow(input)];
    }

    if (input.step.kind === 'worker') {
        return [progressStepToWorkerRow(input)];
    }

    if (input.step.kind === 'widget') {
        return [progressStepToWidgetRow(input)];
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
                    ...(input.step.messagePhase ? { messagePhase: input.step.messagePhase } : {}),
                    runId: input.turn.runId,
                    sessionKey: input.turn.sessionKey,
                    source: 'agent-engine',
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
        runId: input.turn.runId,
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

function progressStepToWidgetRow(input: {
    step: ChatTurnProgressStep;
    timestamp: string;
    turn: ChatTurn;
}): WidgetRow {
    const id = progressActivityId(input.turn.runId, input.step.id);
    const widget = input.step.widget ?? {
        component: null,
        fallbackText: input.step.detail?.trim() || input.step.label,
        id,
        props: null,
        target: null,
        validationError: 'Widget unavailable.',
    };

    return {
        actor: { id: input.turn.agentId, kind: 'agent' },
        completedAt: input.step.status === 'active' ? null : input.timestamp,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'widget',
        runId: input.turn.runId,
        widget: {
            ...widget,
            id,
            props: widget.props ?? null,
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

    if (existing.kind === 'widget' && next.kind === 'widget') {
        return mergeWidgetRows(existing, next);
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

function mergeWidgetRows(existing: WidgetRow, next: WidgetRow): WidgetRow {
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

    return (
        step.kind === 'command' ||
        ['bash', 'command', 'exec', 'shell', 'terminal', 'zsh'].includes(name)
    );
}

function toolNameForStep(step: ChatTurnProgressStep) {
    if (step.kind === 'message') {
        return 'message';
    }
    if (step.kind === 'reasoning') {
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

    if (step.kind === 'message' || step.kind === 'reasoning') {
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
            : row.kind === 'tool' || row.kind === 'widget'
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
