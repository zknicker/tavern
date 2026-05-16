import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';

export type ChatTimeline = NonNullable<ChatLogOutput>['rows'];
export type ChatActiveReply = ChatStatusListOutput['chats'][number]['activeReply'];
export type ChatActiveStatus = ChatStatusListOutput['chats'][number];
type ChatTimelineMessageRow = Extract<ChatTimeline[number], { kind: 'message' }>;

const activeReplyHandoffToleranceMs = 30 * 1000;

export interface ChatTurnProgressStep {
    detail?: string | null;
    id: string;
    kind: 'command' | 'message' | 'plan' | 'reasoning' | 'tool';
    label: string;
    status: 'active' | 'completed' | 'failed';
}

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

function getTimestampMs(timestamp: string) {
    const parsed = Date.parse(timestamp);

    return Number.isNaN(parsed) ? null : parsed;
}

function normalizeReplyText(text: string | null | undefined) {
    return text?.trim() ?? '';
}

function hasCompatibleAssistantIdentity(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    if (row.actor?.kind === 'agent' && row.actor.id !== activeReply.agentId) {
        return false;
    }

    if (row.message.tavernAgentId && row.message.tavernAgentId !== activeReply.agentId) {
        return false;
    }

    return true;
}

function hasCompatibleSession(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    const activeSessionKey = activeReply.sessionKey.trim();
    const rowSessionKey = row.message.sourceSessionKey.trim();

    return !(activeSessionKey && rowSessionKey && activeSessionKey !== rowSessionKey);
}

function isDurableReplyForActiveReply(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    if (
        row.message.senderType !== 'agent' ||
        !hasCompatibleAssistantIdentity(row, activeReply) ||
        !hasCompatibleSession(row, activeReply)
    ) {
        return false;
    }

    const messageTimestamp = getTimestampMs(row.message.timestamp);
    const activeStartedAt = getTimestampMs(activeReply.startedAt);

    if (
        messageTimestamp !== null &&
        activeStartedAt !== null &&
        messageTimestamp >= activeStartedAt
    ) {
        return true;
    }

    const activeText = normalizeReplyText(activeReply.text);

    if (activeText.length === 0 || normalizeReplyText(row.message.content) !== activeText) {
        return false;
    }

    if (messageTimestamp === null || activeStartedAt === null) {
        return true;
    }

    return activeStartedAt - messageTimestamp <= activeReplyHandoffToleranceMs;
}

function hasDurableAssistantReply(rows: ChatTimeline, activeReply: ChatActiveReply) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row.kind !== 'message') {
            continue;
        }

        if (isDurableReplyForActiveReply(row, activeReply)) {
            return true;
        }
    }

    return false;
}

function hasAssistantReplyForActiveTurn(rows: ChatTimeline, activeReply: ChatActiveReply | null) {
    if (!activeReply) {
        return false;
    }

    return hasDurableAssistantReply(rows, activeReply);
}

function getTerminalAssistantReplyTimestamp(rows: ChatTimeline, activeReply: ChatActiveReply) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row.kind !== 'message' || !isDurableReplyForActiveReply(row, activeReply)) {
            continue;
        }

        return row.message.timestamp;
    }

    return null;
}

function hasDurableActivityForTurn(
    rows: ChatTimeline,
    turn: Pick<ChatTurn, 'sessionKey' | 'startedAt'>
) {
    const startedAt = getTimestampMs(turn.startedAt);
    const sessionKey = turn.sessionKey.trim();

    return rows.some((row) => {
        if (row.kind !== 'system' && row.kind !== 'tool') {
            return false;
        }

        const rowSessionKey = row.kind === 'tool' ? row.sessionKey : null;
        const normalizedRowSessionKey = rowSessionKey?.trim() ?? '';

        if (sessionKey && normalizedRowSessionKey && normalizedRowSessionKey !== sessionKey) {
            return false;
        }

        const timestamp =
            row.kind === 'system'
                ? getTimestampMs(row.timestamp ?? '')
                : getTimestampMs(row.startedAt ?? row.completedAt ?? '');

        return timestamp === null || startedAt === null || timestamp >= startedAt;
    });
}

function isSameActiveReply(left: ChatActiveReply | null, right: ChatActiveReply | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.agentId === right.agentId &&
        (left.isThinking ?? true) === (right.isThinking ?? true) &&
        left.runId === right.runId &&
        left.sessionKey === right.sessionKey &&
        left.startedAt === right.startedAt &&
        (left.text ?? '') === (right.text ?? '')
    );
}

function normalizeActiveReply(activeReply: ChatActiveReply | null): ChatActiveReply | null {
    if (!activeReply) {
        return null;
    }

    return {
        ...activeReply,
        isThinking: activeReply.isThinking ?? true,
        text: activeReply.text ?? '',
    };
}

function mergeActiveReplySnapshot(
    current: ChatActiveReply | null,
    incoming: ChatActiveReply | null
): ChatActiveReply | null {
    if (!(current && incoming) || current.runId !== incoming.runId) {
        return incoming;
    }

    const currentText = current.text ?? '';
    const incomingText = incoming.text ?? '';

    return {
        ...incoming,
        isThinking:
            current.isThinking === false && incoming.isThinking !== false
                ? false
                : incoming.isThinking,
        text: incomingText.length === 0 && currentText.length > 0 ? currentText : incomingText,
    };
}

function areSameTimeline(left: ChatTimeline, right: ChatTimeline) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((row, index) => row.id === right[index]?.id);
}

function isSameTurnFailure(left: ChatTurnFailure | null, right: ChatTurnFailure | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return left.error === right.error && left.turn.runId === right.turn.runId;
}

function hasFailureMessage(rows: ChatTimeline, failure: ChatTurnFailure | null) {
    return failure ? hasLoggedTurnFailure(rows, failure.turn.runId) : false;
}

function isSameActiveReplyRun(left: ChatActiveReply | null, right: ChatActiveReply | null) {
    return left?.runId === right?.runId;
}

export function emptyTimelineState(): ChatTimelineState {
    return {
        activeReply: null,
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
        failedTurn: null,
        historyLoaded: false,
        timeline: [],
        totalRows: 0,
    };
}

export function applyLogSnapshot(
    state: ChatTimelineState,
    log: ChatLogOutput | undefined
): ChatTimelineState {
    if (!log) {
        return state;
    }

    const hasTerminalMessage =
        hasAssistantReplyForActiveTurn(log.rows, state.activeReply) ||
        Boolean(state.activeReply && hasLoggedTurnFailure(log.rows, state.activeReply.runId));
    const completedAt =
        state.activeReply && hasTerminalMessage
            ? getTerminalAssistantReplyTimestamp(log.rows, state.activeReply)
            : null;
    const nextActiveReply = hasTerminalMessage ? null : state.activeReply;
    const nextCompletedProgress = resolveCompletedProgress({
        completedAt,
        logRows: log.rows,
        nextActiveReply,
        state,
    });
    const nextFailedTurn = hasFailureMessage(log.rows, state.failedTurn) ? null : state.failedTurn;
    const historyLoaded = true;

    if (
        areSameTimeline(state.timeline, log.rows) &&
        state.totalRows === log.total &&
        state.historyLoaded === historyLoaded &&
        isSameActiveReply(state.activeReply, nextActiveReply) &&
        isSameCompletedProgress(state.completedProgress, nextCompletedProgress) &&
        isSameTurnFailure(state.failedTurn, nextFailedTurn)
    ) {
        return state;
    }

    return {
        activeReply: nextActiveReply,
        activeReplyProgressStartedAt: nextActiveReply ? state.activeReplyProgressStartedAt : null,
        activeReplySteps: nextActiveReply ? state.activeReplySteps : [],
        completedProgress: nextCompletedProgress,
        failedTurn: nextFailedTurn,
        historyLoaded,
        timeline: log.rows,
        totalRows: log.total,
    };
}

export function applyReplySnapshot(
    state: ChatTimelineState,
    activeReply: ChatActiveReply | null
): ChatTimelineState {
    const normalizedActiveReply = mergeActiveReplySnapshot(
        state.activeReply,
        normalizeActiveReply(activeReply)
    );
    const nextActiveReply = (() => {
        if (hasAssistantReplyForActiveTurn(state.timeline, normalizedActiveReply)) {
            return null;
        }

        if (normalizedActiveReply !== null) {
            if (
                state.failedTurn?.turn.runId === normalizedActiveReply.runId ||
                hasLoggedTurnFailure(state.timeline, normalizedActiveReply.runId)
            ) {
                return null;
            }

            return normalizedActiveReply;
        }

        if (state.failedTurn?.turn.runId === state.activeReply?.runId) {
            return null;
        }

        return hasAssistantReplyForActiveTurn(state.timeline, state.activeReply) ||
            Boolean(
                state.activeReply && hasLoggedTurnFailure(state.timeline, state.activeReply.runId)
            ) ||
            state.failedTurn?.turn.runId === state.activeReply?.runId
            ? null
            : state.activeReply;
    })();
    const keepsSameRun = isSameActiveReplyRun(state.activeReply, nextActiveReply);

    if (isSameActiveReply(state.activeReply, nextActiveReply)) {
        return state;
    }

    return {
        ...state,
        activeReply: nextActiveReply,
        activeReplyProgressStartedAt: nextActiveReply
            ? keepsSameRun
                ? state.activeReplyProgressStartedAt
                : null
            : null,
        activeReplySteps: nextActiveReply ? (keepsSameRun ? state.activeReplySteps : []) : [],
        completedProgress:
            nextActiveReply && state.completedProgress?.reply.runId !== nextActiveReply.runId
                ? null
                : state.completedProgress,
        failedTurn: nextActiveReply && keepsSameRun ? state.failedTurn : null,
    };
}

export function applyStatusSnapshot(
    state: ChatTimelineState,
    status: ChatActiveStatus | null
): ChatTimelineState {
    const next = applyReplySnapshot(state, status?.activeReply ?? null);
    const steps = status?.activeReplySteps ?? [];

    if (!status?.activeReply || steps.length === 0 || !next.activeReply) {
        return next;
    }

    if (next.activeReply.runId !== status.activeReply.runId) {
        return next;
    }

    const mergedSteps = mergeProgressSteps(next.activeReplySteps, steps);
    const progressStartedAt =
        next.activeReplyProgressStartedAt ??
        status.activeReplyProgressStartedAt ??
        status.activeReply.startedAt;

    if (
        next.activeReplyProgressStartedAt === progressStartedAt &&
        areSameProgressSteps(next.activeReplySteps, mergedSteps)
    ) {
        return next;
    }

    return {
        ...next,
        activeReplyProgressStartedAt: progressStartedAt,
        activeReplySteps: mergedSteps,
    };
}

export function startTimelineTurn(state: ChatTimelineState, turn: ChatTurn): ChatTimelineState {
    return {
        ...applyReplySnapshot(state, {
            agentId: turn.agentId,
            isThinking: true,
            runId: turn.runId,
            sessionKey: turn.sessionKey,
            startedAt: turn.startedAt,
            text: '',
        }),
        activeReplyProgressStartedAt: null,
        completedProgress: null,
        failedTurn: null,
    };
}

export function updateTimelineTurnProgress(
    state: ChatTimelineState,
    input: {
        receivedAt?: string;
        step: ChatTurnProgressStep;
        turn: ChatTurn;
    }
): ChatTimelineState {
    const stateForTurn =
        state.activeReply?.runId === input.turn.runId
            ? state
            : adoptHydratedReplyTurn(state, input.turn);

    if (!stateForTurn.activeReply || stateForTurn.activeReply.runId !== input.turn.runId) {
        return state;
    }

    const existingIndex = stateForTurn.activeReplySteps.findIndex(
        (step) => step.id === input.step.id
    );
    const nextSteps =
        existingIndex >= 0
            ? stateForTurn.activeReplySteps.map((step, index) =>
                  index === existingIndex ? input.step : step
              )
            : [...stateForTurn.activeReplySteps, input.step];

    return {
        ...stateForTurn,
        activeReplyProgressStartedAt:
            stateForTurn.activeReplyProgressStartedAt ?? input.receivedAt ?? input.turn.startedAt,
        activeReplySteps: nextSteps,
    };
}

function adoptHydratedReplyTurn(state: ChatTimelineState, turn: ChatTurn): ChatTimelineState {
    const activeReply = state.activeReply;

    if (
        !activeReply ||
        activeReply.sessionKey !== turn.sessionKey ||
        state.activeReplySteps.length > 0 ||
        (activeReply.text ?? '').trim().length > 0
    ) {
        return state;
    }

    return {
        ...state,
        activeReply: {
            ...activeReply,
            agentId: turn.agentId,
            runId: turn.runId,
            startedAt: turn.startedAt,
        },
    };
}

function mergeProgressSteps(
    current: ChatTurnProgressStep[],
    incoming: ChatTurnProgressStep[]
): ChatTurnProgressStep[] {
    let next = current;

    for (const step of incoming) {
        const existingIndex = next.findIndex((candidate) => candidate.id === step.id);

        next =
            existingIndex >= 0
                ? next.map((candidate, index) =>
                      index === existingIndex ? mergeProgressStep(candidate, step) : candidate
                  )
                : [...next, step];
    }

    return next;
}

function mergeProgressStep(
    current: ChatTurnProgressStep,
    incoming: ChatTurnProgressStep
): ChatTurnProgressStep {
    if (getProgressStatusRank(current.status) > getProgressStatusRank(incoming.status)) {
        return current;
    }

    return incoming;
}

function getProgressStatusRank(status: ChatTurnProgressStep['status']) {
    switch (status) {
        case 'failed':
            return 2;
        case 'completed':
            return 1;
        case 'active':
            return 0;
    }
}

function areSameProgressSteps(left: ChatTurnProgressStep[], right: ChatTurnProgressStep[]) {
    return (
        left.length === right.length &&
        left.every((step, index) => {
            const candidate = right[index];

            return (
                candidate?.id === step.id &&
                candidate.kind === step.kind &&
                candidate.label === step.label &&
                candidate.status === step.status &&
                (candidate.detail ?? null) === (step.detail ?? null)
            );
        })
    );
}

export function updateTimelineReply(
    state: ChatTimelineState,
    update: ChatReplyUpdate
): ChatTimelineState {
    if (state.failedTurn?.turn.runId === update.turn.runId) {
        return state;
    }

    const existingText =
        state.activeReply && state.activeReply.runId === update.turn.runId
            ? (state.activeReply.text ?? '')
            : '';
    const nextText = update.replace ? update.text : update.text || existingText;
    const nextReply = normalizeActiveReply({
        agentId: update.turn.agentId,
        isThinking: update.isThinking,
        runId: update.turn.runId,
        sessionKey: update.turn.sessionKey,
        startedAt: update.turn.startedAt,
        text: nextText,
    });

    const nextState = applyReplySnapshot(state, nextReply);

    if (
        update.replace === true &&
        update.isThinking === false &&
        state.activeReply?.runId === update.turn.runId &&
        state.activeReplySteps.length > 0 &&
        !nextState.completedProgress
    ) {
        return completeTimelineTurn(nextState, {
            completedAt: new Date().toISOString(),
            turn: update.turn,
        });
    }

    return nextState;
}

export function clearTimelineTurn(
    state: ChatTimelineState,
    input: {
        runId?: string;
    } = {}
): ChatTimelineState {
    if (!state.activeReply) {
        return state;
    }

    if (input.runId && state.activeReply.runId !== input.runId) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
    };
}

export function completeTimelineTurn(
    state: ChatTimelineState,
    input: {
        completedAt: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    if (
        !state.activeReply ||
        state.activeReply.runId !== input.turn.runId ||
        state.activeReplySteps.length === 0
    ) {
        return state;
    }

    return {
        ...state,
        completedProgress: {
            completedAt: input.completedAt,
            reply: state.activeReply,
            startedAt: state.activeReplyProgressStartedAt ?? state.activeReply.startedAt,
            steps: state.activeReplySteps.map((step) =>
                step.status === 'active' ? { ...step, status: 'completed' as const } : step
            ),
        },
    };
}

export function failTimelineTurn(
    state: ChatTimelineState,
    input: {
        error: string;
        turn: ChatTurn;
    }
): ChatTimelineState {
    if (state.activeReply && state.activeReply.runId !== input.turn.runId) {
        return state;
    }

    const failedTurn = {
        error: input.error,
        turn: input.turn,
    };

    if (
        !state.activeReply &&
        state.activeReplySteps.length === 0 &&
        isSameTurnFailure(state.failedTurn, failedTurn)
    ) {
        return state;
    }

    return {
        ...state,
        activeReply: null,
        activeReplyProgressStartedAt: null,
        activeReplySteps: [],
        completedProgress: null,
        failedTurn,
    };
}

function resolveCompletedProgress({
    completedAt,
    logRows,
    nextActiveReply,
    state,
}: {
    completedAt: string | null;
    logRows: ChatTimeline;
    nextActiveReply: ChatActiveReply | null;
    state: ChatTimelineState;
}): ChatCompletedProgress | null {
    if (nextActiveReply) {
        return null;
    }

    if (
        state.activeReply &&
        state.activeReplySteps.length > 0 &&
        completedAt &&
        !hasDurableActivityForTurn(logRows, {
            sessionKey: state.activeReply.sessionKey,
            startedAt: state.activeReply.startedAt,
        })
    ) {
        return {
            completedAt,
            reply: state.activeReply,
            startedAt: state.activeReplyProgressStartedAt ?? state.activeReply.startedAt,
            steps: state.activeReplySteps.map((step) =>
                step.status === 'active' ? { ...step, status: 'completed' as const } : step
            ),
        };
    }

    if (!state.completedProgress) {
        return null;
    }

    return hasDurableActivityForTurn(logRows, {
        sessionKey: state.completedProgress.reply.sessionKey,
        startedAt: state.completedProgress.reply.startedAt,
    })
        ? null
        : state.completedProgress;
}

function isSameCompletedProgress(
    left: ChatCompletedProgress | null,
    right: ChatCompletedProgress | null
) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.completedAt === right.completedAt &&
        left.reply.runId === right.reply.runId &&
        left.startedAt === right.startedAt &&
        left.steps.length === right.steps.length &&
        left.steps.every((step, index) => step.id === right.steps[index]?.id)
    );
}
