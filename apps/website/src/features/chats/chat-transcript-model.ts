import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { getTranscriptItemKey } from './chat-transcript-item-utils.ts';

export type TranscriptRow =
    | NonNullable<ChatLogOutput>['rows'][number]
    | SessionHistoryOutput['rows'][number];

export type TranscriptActor = Exclude<
    Extract<TranscriptRow, { kind: 'message' | 'widget' | 'tool' | 'worker' }>['actor'],
    undefined
>;

export interface ConversationMessageLayout {
    showAgentIdentity: boolean;
    showHumanIdentity: boolean;
}

export type TranscriptItem =
    | { kind: 'activeReply'; reply: ChatActiveReply }
    | { kind: 'activeStatus'; reply: ChatActiveReply; status: 'thinking' }
    | { failure: ChatTurnFailure; kind: 'failure' }
    | { kind: 'row'; row: TranscriptRow };

export interface TranscriptSystemEntry {
    id: string;
    item: TranscriptItem;
    kind: 'system';
    timestamp: string | null;
}

export interface TranscriptTurnEntry {
    actor: TranscriptActor;
    id: string;
    items: TranscriptItem[];
    key: string;
    kind: 'turn';
    participant: 'agent' | 'user';
    // Server-truth turn identity from the owning response, when rows carry
    // it. Live tail items and legacy rows fall back to grouping heuristics.
    responseId: string | null;
    timestamp: string | null;
}

export type TranscriptEntry = TranscriptSystemEntry | TranscriptTurnEntry;

const turnMaxGapMs = 5 * 60 * 1000;

export function buildTranscriptEntries(input: {
    activeReplies: readonly ChatActiveReply[];
    failedTurns?: readonly ChatTurnFailure[];
    rows: TranscriptRow[];
}) {
    const items = buildTranscriptItems(input);
    const entries: TranscriptEntry[] = [];

    for (const item of items) {
        const participant = getItemParticipant(item);

        if (participant === 'system') {
            entries.push({
                id: getTranscriptItemKey(item),
                item,
                kind: 'system',
                timestamp: getItemTimestamp(item),
            });
            continue;
        }

        const key = getTurnKey(item, participant);
        const responseId = getItemResponseId(item);
        const previous = entries.at(-1);

        if (previous?.kind === 'turn' && canAppendToTurn(previous, item, participant, key)) {
            previous.items.push(item);
            previous.responseId ??= responseId;
            continue;
        }

        entries.push({
            actor: getItemActor(item),
            id: getTranscriptItemKey(item),
            items: [item],
            key,
            kind: 'turn',
            participant,
            responseId,
            timestamp: getItemTimestamp(item),
        });
    }

    applyStableTurnEntryIds(entries);

    return entries;
}

// Agent turn entries are keyed by run identity when any item carries one, so
// the entry (and the work disclosure inside it) keeps a single React identity
// from the first live item through the durable refetch. Keying by the first
// item alone remounts the whole turn when the leading item changes shape
// across the live → durable swap.
function applyStableTurnEntryIds(entries: TranscriptEntry[]) {
    const usedIds = new Set<string>();

    for (const entry of entries) {
        if (entry.kind !== 'turn' || entry.participant !== 'agent') {
            continue;
        }

        // Run identity first: live tail items only carry the run id, so a
        // response-keyed id would remount the turn at the live → durable
        // swap. The response id covers turns with no extractable run id.
        const runId = entry.items.map(getItemRunId).find((value) => value !== null);
        const candidate = runId
            ? `turn:${runId}`
            : entry.responseId
              ? `turn:${entry.responseId}`
              : entry.id;

        entry.id = usedIds.has(candidate) ? entry.id : candidate;
        usedIds.add(entry.id);
    }
}

export function getItemRunId(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return item.reply.runId;
    }

    if (item.kind === 'failure') {
        return item.failure.turn.runId;
    }

    if (item.row.kind === 'message') {
        const fromMetadata = runtimeMetadataRunId(item.row.message.metadata);

        if (fromMetadata) {
            return fromMetadata;
        }
    }

    if (item.row.kind === 'system' && item.row.systemKind === 'turnStatus') {
        return item.row.turnStatus.runId;
    }

    // Server-projected work rows carry run identity as a field; prefer it
    // over deriving from row ids.
    if ('runId' in item.row && typeof item.row.runId === 'string' && item.row.runId.length > 0) {
        return item.row.runId;
    }

    if (item.row.kind === 'system' && item.row.systemKind === 'thinking') {
        const messageId = item.row.thinking.messageId.trim();

        if (isLikelyRunId(messageId)) {
            return messageId;
        }
    }

    // Tool, worker, and some thinking rows carry no runtime metadata, but
    // their activity ids embed the run id. Without this, the turn id flips
    // between turn:<runId> and a row id whenever the live tail toggles,
    // remounting the whole turn mid-stream.
    return activityRowRunId(item.row.id);
}

// Activity ids embed the run id followed by a part marker. Run ids carry a
// per-agent suffix (`run_<uuid>_<agent>`), so the marker-based capture is
// lazy up to the first known marker; ids with opaque part suffixes (live
// tool steps keyed by raw tool-call id) fall back to the uuid boundary.
// Rows that carry a `runId` field never reach this derivation.
const markedActivityRunIdPattern =
    /^act_(run_.+?)_(?:tool|message|reasoning|widget|silent_reply|runtime_notice)(?:_|$)/;
const uuidActivityRunIdPattern =
    /^act_(run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/;

function activityRowRunId(id: string) {
    return (
        markedActivityRunIdPattern.exec(id)?.[1] ?? uuidActivityRunIdPattern.exec(id)?.[1] ?? null
    );
}

function runtimeMetadataRunId(metadata: Record<string, unknown> | null | undefined) {
    const runtime = metadata?.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const runId = (runtime as Record<string, unknown>).runId;

    return typeof runId === 'string' && runId.trim().length > 0 ? runId : null;
}

function isLikelyRunId(value: string) {
    return value.startsWith('run_') || value.startsWith('run-');
}

function buildTranscriptItems(input: {
    activeReplies: readonly ChatActiveReply[];
    failedTurns?: readonly ChatTurnFailure[];
    rows: TranscriptRow[];
}) {
    // Once a turn's durable reply is in the rows, its live reply items are
    // redundant: rendering both creates sibling segments with one `reply:`
    // key, which restructures the turn (and replays animations) during the
    // completion handoff.
    const activeReplies = input.activeReplies.filter(
        (reply) =>
            !(
                hasDurableReplyRow(input.rows, reply.runId) ||
                hasStoppedTurnRow(input.rows, reply.runId)
            )
    );
    const items: TranscriptItem[] = input.rows.flatMap((row) => {
        if (isDuplicateReplyThinkingRow(row, input.rows, activeReplies)) {
            return [];
        }

        return [{ kind: 'row', row }];
    });

    // One live item per run; run-keyed grouping keeps each in its own turn.
    for (const reply of activeReplies) {
        if ((reply.text?.trim() ?? '').length > 0) {
            items.push({ kind: 'activeReply', reply });
        } else {
            items.push({ kind: 'activeStatus', reply, status: 'thinking' });
        }
    }

    for (const failure of input.failedTurns ?? []) {
        items.push({ failure, kind: 'failure' });
    }

    return items;
}

function hasDurableReplyRow(rows: TranscriptRow[], runId: string) {
    return rows.some(
        (row) =>
            row.kind === 'message' &&
            row.message.senderType === 'agent' &&
            !row.id.startsWith('act_') &&
            getItemRunId({ kind: 'row', row }) === runId
    );
}

function hasStoppedTurnRow(rows: TranscriptRow[], runId: string) {
    return rows.some(
        (row) =>
            row.kind === 'system' &&
            row.systemKind === 'turnStatus' &&
            row.turnStatus.runId === runId
    );
}

function isThinkingRow(row: TranscriptRow) {
    return row.kind === 'system' && row.systemKind === 'thinking';
}

function isDuplicateReplyThinkingRow(
    row: TranscriptRow,
    rows: TranscriptRow[],
    activeReplies: readonly ChatActiveReply[]
) {
    if (!isThinkingRow(row)) {
        return false;
    }

    const runId = getItemRunId({ kind: 'row', row });
    const thinkingText = row.thinking.text;

    if (!(runId && thinkingText.trim())) {
        return false;
    }

    const activeReply = activeReplies.find((reply) => reply.runId === runId);

    if (activeReply && isTranscriptTextPrefix(thinkingText, activeReply.text ?? '')) {
        return true;
    }

    return rows.some(
        (candidate) =>
            candidate !== row &&
            isDurableAgentReplyRow(candidate, runId) &&
            isTranscriptTextPrefix(thinkingText, candidate.message.content)
    );
}

function isDurableAgentReplyRow(
    row: TranscriptRow,
    runId: string
): row is Extract<TranscriptRow, { kind: 'message' }> {
    return (
        row.kind === 'message' &&
        row.message.senderType === 'agent' &&
        !row.id.startsWith('act_') &&
        getItemRunId({ kind: 'row', row }) === runId
    );
}

function isTranscriptTextPrefix(prefix: string, value: string) {
    const normalizedPrefix = normalizeTranscriptText(prefix);
    const normalizedValue = normalizeTranscriptText(value);

    return Boolean(normalizedPrefix && normalizedValue.startsWith(normalizedPrefix));
}

function normalizeTranscriptText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

/**
 * Activity-backed message rows (act_ ids) are intra-turn narration projected
 * from response activities. They belong to the work log and are never the
 * turn's durable reply.
 */
export function isActivityBackedMessageRow(row: TranscriptRow) {
    return row.kind === 'message' && row.id.startsWith('act_');
}

/**
 * Runs whose final reply is already in the transcript — from a durable agent
 * message or the streamed active reply. Narration for these runs has been
 * superseded and stays out of the chat pane.
 */
export function getRepliedRunIds(
    rows: TranscriptRow[],
    activeReplies: readonly ChatActiveReply[]
): ReadonlySet<string> {
    const runIds = new Set<string>();

    for (const row of rows) {
        if (
            row.kind === 'message' &&
            row.message.senderType === 'agent' &&
            !isActivityBackedMessageRow(row)
        ) {
            const runId = getItemRunId({ kind: 'row', row });

            if (runId) {
                runIds.add(runId);
            }
        }
    }

    for (const reply of activeReplies) {
        if (reply.text?.trim()) {
            runIds.add(reply.runId);
        }
    }

    return runIds;
}

function canAppendToTurn(
    entry: TranscriptTurnEntry,
    item: TranscriptItem,
    participant: 'agent' | 'user',
    key: string
) {
    if (entry.participant !== participant) {
        return false;
    }

    // Response identity is server truth for agent turn membership: rows of
    // one response always share a turn, rows of different responses never
    // do, regardless of timestamp gaps.
    const itemResponseId = getItemResponseId(item);

    if (participant === 'agent' && entry.responseId && itemResponseId) {
        return entry.responseId === itemResponseId;
    }

    // Live-projected rows carry no response id, so run identity is the
    // fallback boundary: items of different runs never share an agent turn,
    // keeping a new run's narration out of the previous run's entry.
    if (participant === 'agent') {
        const itemRunId = getItemRunId(item);
        const entryRunId = getTurnEntryRunId(entry);

        if (itemRunId && entryRunId && itemRunId !== entryRunId) {
            return false;
        }
    }

    const previous = entry.items.at(-1);

    if (canAppendAgentActivity(entry, item, previous)) {
        return true;
    }

    if (entry.key !== key) {
        return false;
    }

    if (previous && hasExplicitConnection(item, previous)) {
        return true;
    }

    const currentTimestamp = parseTimestamp(getItemTimestamp(item));
    const previousTimestamp = parseTimestamp(previous ? getItemTimestamp(previous) : null);

    return Math.abs(currentTimestamp - previousTimestamp) <= turnMaxGapMs;
}

function getTurnEntryRunId(entry: TranscriptTurnEntry) {
    for (const item of entry.items) {
        const runId = getItemRunId(item);

        if (runId) {
            return runId;
        }
    }

    return null;
}

function canAppendAgentActivity(
    entry: TranscriptTurnEntry,
    item: TranscriptItem,
    previous: TranscriptItem | undefined
) {
    if (entry.participant !== 'agent' || !(isActivityItem(item) || isActivityItem(previous))) {
        return false;
    }

    const entryActorKey = getActorKey(entry.actor);
    const itemActorKey = getActorKey(getItemActor(item));

    if (entryActorKey !== itemActorKey && entryActorKey !== null && itemActorKey !== null) {
        return false;
    }

    const currentTimestamp = parseTimestamp(getItemTimestamp(item));
    const previousTimestamp = parseTimestamp(previous ? getItemTimestamp(previous) : null);

    return Math.abs(currentTimestamp - previousTimestamp) <= turnMaxGapMs;
}

function isActivityItem(item: TranscriptItem | undefined) {
    if (!item) {
        return false;
    }

    if (item.kind !== 'row') {
        return item.kind === 'failure';
    }

    return item.row.kind !== 'message' && item.row.kind !== 'widget';
}

function hasExplicitConnection(current: TranscriptItem, previous: TranscriptItem) {
    if (current.kind !== 'row' || previous.kind !== 'row') {
        return false;
    }

    if (current.row.kind === 'system' || previous.row.kind === 'system') {
        return false;
    }

    return current.row.connectsToPrevious && previous.row.connectsToNext;
}

function getItemParticipant(item: TranscriptItem): 'agent' | 'system' | 'user' {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return 'agent';
    }

    const { row } = item;

    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 'user' : 'agent';
    }

    if (row.kind === 'tool' || row.kind === 'widget' || row.kind === 'worker') {
        return row.sessionKey?.trim() || row.actor?.kind === 'agent' ? 'agent' : 'system';
    }

    if (row.systemKind === 'turnStatus') {
        return 'agent';
    }

    if (row.systemKind === 'runtimeNotice') {
        return 'system';
    }

    return 'agent';
}

function getTurnKey(item: TranscriptItem, participant: 'agent' | 'user') {
    return `${participant}:${getItemActorKey(item)}:${getItemSessionKey(item) ?? 'no-session'}`;
}

function getItemActor(item: TranscriptItem): TranscriptActor {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return { id: item.reply.agentId, kind: 'agent' };
    }

    if (item.kind === 'failure') {
        return { id: item.failure.turn.agentId, kind: 'agent' };
    }

    if (item.row.kind === 'system' && item.row.systemKind === 'turnStatus') {
        return { id: item.row.turnStatus.agentId, kind: 'agent' };
    }

    if (item.row.kind !== 'system') {
        return item.row.actor;
    }

    return null;
}

function getItemActorKey(item: TranscriptItem) {
    return getActorKey(getItemActor(item)) ?? 'system';
}

function getActorKey(actor: TranscriptActor) {
    if (actor) {
        return `${actor.kind}:${actor.id}`;
    }
    return null;
}

/**
 * Whether this entry's rendering can depend on the live reply. Streaming
 * updates replace the activeReply object on every event, so list renderers
 * pass it only to entries that can actually be active and let memoized
 * historical rows skip the re-render.
 */
export function findTranscriptEntryActiveReply(
    entry: TranscriptEntry,
    activeReplies: readonly ChatActiveReply[]
): ChatActiveReply | null {
    if (entry.kind !== 'turn' || entry.participant !== 'agent') {
        return null;
    }

    // An entry that already carries a live item belongs to exactly that run;
    // the sessionKey heuristic below is only for run-less historical rows.
    const liveItem = entry.items.find(
        (item): item is Extract<TranscriptItem, { kind: 'activeReply' | 'activeStatus' }> =>
            item.kind === 'activeReply' || item.kind === 'activeStatus'
    );

    if (liveItem) {
        return activeReplies.find((reply) => reply.runId === liveItem.reply.runId) ?? null;
    }

    return activeReplies.find((reply) => transcriptEntryUsesActiveReply(entry, reply)) ?? null;
}

export function transcriptEntryUsesActiveReply(
    entry: TranscriptEntry,
    activeReply: ChatActiveReply | null
) {
    if (!activeReply || entry.kind !== 'turn' || entry.participant !== 'agent') {
        return false;
    }

    if (entry.items.some((item) => item.kind === 'activeReply' || item.kind === 'activeStatus')) {
        return true;
    }

    if (
        entry.items.some(
            (item) =>
                item.kind === 'row' &&
                item.row.kind === 'message' &&
                !isActivityBackedMessageRow(item.row)
        )
    ) {
        return false;
    }

    return entry.items.some((item) => getItemSessionKey(item) === activeReply.sessionKey);
}

function getItemResponseId(item: TranscriptItem) {
    if (item.kind !== 'row') {
        return null;
    }

    // Session-history row kinds never carry a response id.
    return 'responseId' in item.row ? (item.row.responseId ?? null) : null;
}

export function getItemSessionKey(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return item.reply.sessionKey;
    }

    if (item.kind === 'failure') {
        return item.failure.turn.sessionKey;
    }

    const { row } = item;

    if (row.kind === 'message') {
        const sessionKey = row.message.sourceSessionKey.trim();
        return sessionKey.length > 0 ? sessionKey : null;
    }

    if (row.kind === 'tool' || row.kind === 'widget' || row.kind === 'worker') {
        return row.sessionKey;
    }

    if (row.systemKind === 'turnStatus') {
        return row.turnStatus.sessionKey;
    }

    return null;
}

export function getItemTimestamp(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return item.reply.startedAt;
    }

    if (item.kind === 'failure') {
        return item.failure.turn.startedAt;
    }

    const { row } = item;

    if (row.kind === 'message') {
        return row.message.timestamp;
    }

    if (row.kind === 'tool' || row.kind === 'widget' || row.kind === 'worker') {
        return row.startedAt ?? row.completedAt;
    }

    return row.timestamp;
}

function parseTimestamp(timestamp: string | null) {
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}
