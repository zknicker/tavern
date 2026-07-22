import type { TavernChatMessage } from '@tavern/api';
import { formatDeliveryEnvelope } from '../cli/agent-format.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { toAgentMessage } from './agent-messages.ts';
import { formatAgentTarget } from './agent-targets.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat, getMessage, listRecentMessagesBetween } from './chat-api/index.ts';
import { listInboxPierces, listPendingInboxTargets } from './inbox-cursors.ts';

// Drain composition (I1, ws2-turn-shapes.md §3): one idle-wake turn delivers
// ALL pending bodies batched as labeled envelopes — ordinary rows from every
// pending target plus pierce rows — closed by Raft's verbatim two-line
// trailer. Envelope rendering shares the CLI formatter: one renderer for
// deliveries, `message check` output, and prompts.

// Bounded per drain; the runner re-drains while `delivered` stays ahead of
// `seen`, so a backlog lands in successive chunks without skipping rows.
const maxEnvelopesPerDrain = 40;

export const drainTrailer = [
    'Respond as appropriate. Complete all your work before stopping.',
    "Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.",
].join('\n');

export interface DrainDelivery {
    /** Sequence proofs advanced to `seen` when the turn settles. */
    embeddedSeqByChatId: Map<string, number>;
    envelopeCount: number;
    /** Whether any embedded envelope was authored by a human. */
    hasHumanEnvelope: boolean;
    pierceMessageIds: string[];
    prompt: string;
}

export interface PendingInboxRow {
    chatId: string;
    message: TavernChatMessage;
    pierce: boolean;
}

/**
 * Every queued-but-unseen row for the session, oldest first: ordinary rows
 * between `seen` and `delivered` per target, plus pierce rows. Shared by
 * drain composition and the `message check` pull.
 */
export function collectPendingInboxRows(
    input: { agentId: string; limit: number; sessionId: string },
    db: Database = getDb()
): PendingInboxRow[] {
    const participantId = createAgentParticipantId(input.agentId);
    const rows: PendingInboxRow[] = [];

    for (const target of listPendingInboxTargets(input.sessionId, db)) {
        const pending = listRecentMessagesBetween(
            target.chatId,
            {
                afterSequence: target.seenUpToSeq,
                beforeSequence: target.deliveredUpToSeq + 1,
                limit: input.limit,
            },
            db
        ).filter((message) => isDeliverableRow(message, input.agentId, participantId));
        rows.push(...pending.map((message) => ({ chatId: target.chatId, message, pierce: false })));
    }
    for (const pierce of listInboxPierces(input.sessionId, db)) {
        const message = getMessage(pierce.messageId, db);
        if (message && isDeliverableRow(message, input.agentId, participantId)) {
            rows.push({ chatId: pierce.chatId, message, pierce: true });
        }
    }

    return rows
        .sort((a, b) => a.message.created_at.localeCompare(b.message.created_at))
        .slice(0, input.limit);
}

export function composeDrainDelivery(
    input: { agentId: string; sessionId: string },
    db: Database = getDb()
): DrainDelivery | null {
    const embedded = collectPendingInboxRows(
        { agentId: input.agentId, limit: maxEnvelopesPerDrain, sessionId: input.sessionId },
        db
    );
    if (embedded.length === 0) {
        return null;
    }

    const lines: string[] = [];
    const embeddedSeqByChatId = new Map<string, number>();
    const pierceMessageIds: string[] = [];
    let hasHumanEnvelope = false;
    for (const row of embedded) {
        const chat = getChat(row.chatId, db);
        const target = chat ? formatAgentTarget(input.agentId, chat, db) : null;
        if (!target) {
            continue;
        }
        const message = toAgentMessage(row.message, db);
        lines.push(formatDeliveryEnvelope(target, message));
        hasHumanEnvelope ||= message.sender.type === 'human';
        if (row.pierce) {
            pierceMessageIds.push(row.message.id);
        }
        const previous = embeddedSeqByChatId.get(row.chatId) ?? 0;
        embeddedSeqByChatId.set(row.chatId, Math.max(previous, row.message.sequence));
    }
    if (lines.length === 0) {
        return null;
    }

    const header = lines.length === 1 ? 'New message received:' : 'New messages received:';
    return {
        embeddedSeqByChatId,
        envelopeCount: lines.length,
        hasHumanEnvelope,
        pierceMessageIds,
        prompt: [header, '', lines.join('\n'), '', drainTrailer].join('\n'),
    };
}

function isDeliverableRow(
    message: TavernChatMessage,
    agentId: string,
    participantId: string
): boolean {
    if (message.deleted_at) {
        return false;
    }
    if (message.role !== 'assistant' && message.role !== 'user' && message.role !== 'system') {
        return false;
    }
    return message.author.id !== agentId && message.author.id !== participantId;
}
