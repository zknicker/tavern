import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';
import {
    type ActiveReplyMergeOptions,
    areSameActiveReplies,
    findActiveReply,
    hasTerminalReplyOrFailure,
    mergeActiveReplySnapshot,
    normalizeActiveReply,
    removeActiveReply,
    upsertActiveReply,
} from './chat-timeline-reply.ts';
import {
    hasTurnStatusRow,
    isOptimisticStopRow,
    isTurnStatusRow,
} from './chat-timeline-turn-status.ts';
import type {
    ChatActiveReply,
    ChatTimeline,
    ChatTimelineState,
    ChatTurnFailure,
} from './chat-timeline-types.ts';

type ChatLogPage = NonNullable<ChatLogOutput>;
type ChatLogInput = Omit<ChatLogPage, 'activeReplies' | 'failedTurns'> &
    Partial<Pick<ChatLogPage, 'activeReplies' | 'failedTurns'>>;

export function emptyTimelineState(): ChatTimelineState {
    return {
        activeReplies: [],
        activeTurns: [],
        failedTurns: [],
        historyLoaded: false,
        timeline: [],
        totalMessages: 0,
        turnEvidence: {},
    };
}

export function applyLogSnapshot(
    state: ChatTimelineState,
    log: ChatLogInput | undefined
): ChatTimelineState {
    if (!log) {
        return state;
    }

    const snapshot = normalizeChatLog(log);
    const isTerminalRun = (runId: string) =>
        hasTurnStatusRow(snapshot.rows, runId) ||
        snapshot.failedTurns.some((failure) => failure.turn.runId === runId);
    const survivingReplies = state.activeReplies.filter(
        (reply) =>
            !(
                hasTerminalReplyOrFailure({ activeReply: reply, rows: snapshot.rows }) ||
                isTerminalRun(reply.runId)
            )
    );
    const nextActiveReplies = mergeSnapshotReplies(survivingReplies, snapshot, isTerminalRun);
    const nextActiveTurns = state.activeTurns.filter(
        (turn) =>
            !(
                isTerminalRun(turn.runId) ||
                hasLoggedTurnFailure(snapshot.rows, turn.runId) ||
                hasTerminalReplyOrFailure({
                    activeReply: { ...turn, text: '' },
                    rows: snapshot.rows,
                })
            )
    );
    const nextFailedTurns = mergeSnapshotFailures(state.failedTurns, snapshot);
    const historyLoaded = true;
    // The loaded transcript only grows while the chat stays open. The tail
    // page refetches from the newest message, so new durable turns slide the
    // fetched window past rows the user may be reading; retained history
    // keeps them until the chat unmounts.
    const loggedRows = retainLoadedHistory({
        hasOlderHistory: snapshot.nextBeforeSequence !== null,
        liveRunIds: [
            ...state.activeReplies.map((reply) => reply.runId),
            ...state.activeTurns.map((turn) => turn.runId),
        ],
        logged: snapshot.rows,
        previous: state.timeline,
    });
    const nextTimeline = mergeActiveProgressRows({
        liveRows: state.timeline,
        loggedRows,
        runIds: nextActiveReplies.map((reply) => reply.runId),
    });
    const nextTotal = snapshot.totalMessages;

    if (
        areSameTimeline(state.timeline, nextTimeline) &&
        state.totalMessages === nextTotal &&
        state.historyLoaded === historyLoaded &&
        areSameActiveReplies(state.activeReplies, nextActiveReplies) &&
        areSameActiveTurns(state.activeTurns, nextActiveTurns) &&
        areSameTurnFailures(state.failedTurns, nextFailedTurns)
    ) {
        return state;
    }

    return {
        activeReplies: nextActiveReplies,
        activeTurns: nextActiveTurns,
        failedTurns: nextFailedTurns,
        historyLoaded,
        timeline: nextTimeline,
        totalMessages: nextTotal,
        // Live evidence only serves running turns; ended runs read the
        // durable chat.turn.evidence query instead.
        turnEvidence: pruneTurnEvidence(state.turnEvidence, [
            ...nextActiveReplies.map((reply) => reply.runId),
            ...nextActiveTurns.map((turn) => turn.runId),
        ]),
    };
}

function pruneTurnEvidence(
    turnEvidence: ChatTimelineState['turnEvidence'],
    liveRunIds: readonly string[]
): ChatTimelineState['turnEvidence'] {
    const live = new Set(liveRunIds);
    const keys = Object.keys(turnEvidence);

    if (keys.every((runId) => live.has(runId))) {
        return turnEvidence;
    }

    return Object.fromEntries(Object.entries(turnEvidence).filter(([runId]) => live.has(runId)));
}

// Snapshot replies fill in runs the client has not seen live (another
// device's turn, a reload mid-turn); live-streamed text always wins the merge.
function mergeSnapshotReplies(
    replies: ChatActiveReply[],
    snapshot: ChatLogPage,
    isTerminalRun: (runId: string) => boolean
) {
    let next = replies;

    for (const snapshotReply of snapshot.activeReplies) {
        if (
            isTerminalRun(snapshotReply.runId) ||
            hasTerminalReplyOrFailure({ activeReply: snapshotReply, rows: snapshot.rows })
        ) {
            continue;
        }

        const merged = mergeActiveReplySnapshot(
            findActiveReply(next, snapshotReply.runId),
            normalizeActiveReply(snapshotReply)
        );

        if (merged) {
            next = upsertActiveReply(next, merged);
        }
    }

    return next;
}

// Durable failures (with responseId, so dismissal works) win over live-event
// failures for the same run; live failures survive until the log confirms or
// contradicts them.
function mergeSnapshotFailures(failures: ChatTurnFailure[], snapshot: ChatLogPage) {
    const next = failures.filter(
        (failure) =>
            !(
                snapshot.failedTurns.some(
                    (snapshotFailure) => snapshotFailure.turn.runId === failure.turn.runId
                ) || hasLoggedTurnFailure(snapshot.rows, failure.turn.runId)
            )
    );
    const merged = [...next, ...snapshot.failedTurns];

    return merged.length === failures.length &&
        merged.every((failure, index) => isSameTurnFailure(failure, failures[index] ?? null))
        ? failures
        : merged;
}

function normalizeChatLog(log: ChatLogInput): ChatLogPage {
    return {
        activeReplies: log.activeReplies ?? [],
        failedTurns: log.failedTurns ?? [],
        limit: log.limit,
        nextBeforeSequence: log.nextBeforeSequence,
        rows: log.rows,
        totalMessages: log.totalMessages,
    };
}

export function applyReplySnapshot(
    state: ChatTimelineState,
    activeReply: ChatActiveReply,
    options: ActiveReplyMergeOptions = {}
): ChatTimelineState {
    // A run the client already marked failed stays failed; only live turn
    // events (authoritative) may write to it again, and those are filtered
    // upstream in updateTimelineReply.
    if (
        !options.authoritative &&
        state.failedTurns.some((failure) => failure.turn.runId === activeReply.runId)
    ) {
        return state;
    }

    const merged = mergeActiveReplySnapshot(
        findActiveReply(state.activeReplies, activeReply.runId),
        normalizeActiveReply(activeReply),
        options
    );
    const isTerminal =
        merged === null ||
        hasTerminalReplyOrFailure({ activeReply: merged, rows: state.timeline }) ||
        hasTurnStatusRow(state.timeline, merged.runId);
    const nextActiveReplies = isTerminal
        ? removeActiveReply(state.activeReplies, activeReply.runId)
        : upsertActiveReply(state.activeReplies, merged);

    if (nextActiveReplies === state.activeReplies) {
        return state;
    }

    return {
        ...state,
        activeReplies: nextActiveReplies,
    };
}

export function isSameTurnFailure(left: ChatTurnFailure | null, right: ChatTurnFailure | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.error === right.error &&
        left.turn.runId === right.turn.runId &&
        left.responseId === right.responseId
    );
}

function areSameTurnFailures(left: readonly ChatTurnFailure[], right: readonly ChatTurnFailure[]) {
    return (
        left === right ||
        (left.length === right.length &&
            left.every((failure, index) => isSameTurnFailure(failure, right[index] ?? null)))
    );
}

function areSameActiveTurns(
    left: ChatTimelineState['activeTurns'],
    right: ChatTimelineState['activeTurns']
) {
    return (
        left === right ||
        (left.length === right.length &&
            left.every((turn, index) => turn.runId === right[index]?.runId))
    );
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

// Rows we already showed stay loaded when the fetched window no longer
// covers the full log: a slid window can drop any loaded row, not just the
// timestamp-oldest. A full-coverage window is authoritative — a row missing
// there was deleted. The live runs' own progress rows are placeholders until
// the log confirms them, so they never qualify as retained history.
function retainLoadedHistory(input: {
    hasOlderHistory: boolean;
    liveRunIds: string[];
    logged: ChatTimeline;
    previous: ChatTimeline;
}): ChatTimeline {
    if (!input.hasOlderHistory || input.previous.length === 0 || input.logged.length === 0) {
        return input.logged;
    }

    const loggedIds = new Set<string>();
    const loggedStoppedRunIds = stoppedRunIds(input.logged);

    for (const row of input.logged) {
        loggedIds.add(row.id);

        if (row.kind === 'message') {
            loggedIds.add(row.message.id);
        }
    }

    const retainedRows = input.previous.filter(
        (row) =>
            !(
                loggedIds.has(row.id) ||
                (row.kind === 'message' && loggedIds.has(row.message.id)) ||
                (isOptimisticStopRow(row) && loggedStoppedRunIds.has(row.turnStatus.runId)) ||
                isLiveRunActivityRowId(row.id, input.liveRunIds)
            )
    );

    return retainedRows.length === 0
        ? input.logged
        : [...retainedRows, ...input.logged].sort(compareTimelineRows);
}

function isLiveRunActivityRowId(rowId: string, runIds: string[]) {
    return runIds.some(
        (runId) => rowId.startsWith(`act_${runId}_`) || rowId.startsWith(`act_${runId}-`)
    );
}

function mergeActiveProgressRows(input: {
    liveRows: ChatTimeline;
    loggedRows: ChatTimeline;
    runIds: string[];
}) {
    if (input.runIds.length === 0) {
        return input.loggedRows;
    }

    const loggedIds = new Set(input.loggedRows.map((row) => row.id));
    const loggedStoppedRunIds = stoppedRunIds(input.loggedRows);
    const missingLiveRows = input.liveRows.filter(
        (row) =>
            (isOptimisticStopRow(row)
                ? !loggedStoppedRunIds.has(row.turnStatus.runId)
                : isLiveProgressRow(row, input.runIds) ||
                  isLiveSteerNoticeRow(row, input.runIds)) && !loggedIds.has(row.id)
    );

    if (missingLiveRows.length === 0) {
        return input.loggedRows;
    }

    return [...input.loggedRows, ...missingLiveRows].sort(compareTimelineRows);
}

function stoppedRunIds(rows: ChatTimeline) {
    return new Set(rows.filter(isTurnStatusRow).map((row) => row.turnStatus.runId));
}

function isLiveProgressRow(row: ChatTimeline[number], runIds: string[]) {
    if (row.kind !== 'tool' || !row.id.startsWith('act_')) {
        return false;
    }

    return runIds.some((runId) => row.id.startsWith(`act_${runId}_`));
}

function isLiveSteerNoticeRow(row: ChatTimeline[number], runIds: string[]) {
    if (
        row.kind !== 'message' ||
        !row.id.startsWith('act_') ||
        !row.id.endsWith('_runtime_notice_steered_message')
    ) {
        return false;
    }

    return runIds.some((runId) => row.id === `act_${runId}_runtime_notice_steered_message`);
}

function compareTimelineRows(left: ChatTimeline[number], right: ChatTimeline[number]) {
    const timestampDelta = rowTimestamp(left) - rowTimestamp(right);

    return timestampDelta || rowSortRank(left) - rowSortRank(right);
}

function rowTimestamp(row: ChatTimeline[number]) {
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

function rowSortRank(row: ChatTimeline[number]) {
    if (row.kind === 'message') {
        if (row.id.startsWith('act_')) {
            return 1;
        }
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}
