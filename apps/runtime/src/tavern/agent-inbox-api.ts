import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { listFollowedThreadIds, listMutedChannelIds } from './agent-attention.ts';
import { type AgentMessage, toAgentMessage } from './agent-messages.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { formatAgentTarget } from './agent-targets.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat } from './chat-api/index.ts';
import { clearInboxPierces, listInboxCursors } from './inbox-cursors.ts';
import { collectPendingInboxRows } from './inbox-drain.ts';
import { collectInboxTargetSummaries, type InboxTargetSummary } from './inbox-notices.ts';
import { advanceServedCursor } from './served-ledger.ts';

// Agent pull surface (WS4): `message check` drains pending bodies, `inbox
// check` lists pending targets. Serving a pull advances `served` (the
// hold-decision assist, W1a); `seen` advances when the tool result commits
// back into the session stream — the runner's settle-time served-snapshot
// comparison observes exactly that. A turn that pulled and died leaves
// served > seen and catch-up re-delivers from `seen` (I3).

const maxCheckMessages = 40;

export interface AgentMessageCheckResult {
    messages: Array<{ message: AgentMessage; target: string }>;
    more: boolean;
}

export function checkAgentMessages(
    agentId: string,
    db: Database = getDb()
): AgentMessageCheckResult {
    const session = ensureCurrentAgentSession({ agentId });
    const rows = collectPendingInboxRows(
        { agentId, limit: maxCheckMessages + 1, sessionId: session.id },
        db
    );
    const served = rows.slice(0, maxCheckMessages);
    const messages: AgentMessageCheckResult['messages'] = [];
    const pierceMessageIds: string[] = [];
    for (const row of served) {
        const chat = getChat(row.chatId, db);
        const target = chat ? formatAgentTarget(agentId, chat, db) : null;
        if (!target) {
            continue;
        }
        messages.push({ message: toAgentMessage(row.message, db), target });
        advanceServedCursor({
            chatId: row.chatId,
            seq: row.message.sequence,
            sessionId: session.id,
        });
        if (row.pierce) {
            pierceMessageIds.push(row.message.id);
        }
    }
    if (pierceMessageIds.length > 0) {
        clearInboxPierces({ messageIds: pierceMessageIds, sessionId: session.id });
    }
    return { messages, more: rows.length > maxCheckMessages };
}

export interface AgentInboxCheckResult {
    rows: InboxTargetSummary[];
    totalPending: number;
}

export function checkAgentInbox(agentId: string, db: Database = getDb()): AgentInboxCheckResult {
    const rows = collectInboxTargetSummaries(agentId, db);
    return {
        rows,
        totalPending: rows.reduce((sum, row) => sum + row.pendingCount, 0),
    };
}

/**
 * Read-only inbox visibility for the agent profile (I4): pending targets,
 * muted channels, followed threads, and dev-mode cursors. Attention stays
 * agent-owned — this surface never mutates.
 */
export function readAgentInboxVisibility(agentId: string, db: Database = getDb()) {
    const session = ensureCurrentAgentSession({ agentId });
    const participantId = createAgentParticipantId(agentId);
    const targetFor = (chatId: string) => {
        const chat = getChat(chatId, db);
        return chat ? formatAgentTarget(agentId, chat, db) : null;
    };
    return {
        cursors: listInboxCursors(session.id, db).flatMap((row) => {
            const target = targetFor(row.chatId);
            return target
                ? [{ delivered: row.deliveredUpToSeq, seen: row.seenUpToSeq, target }]
                : [];
        }),
        followedThreads: listFollowedThreadIds(participantId, db).flatMap((chatId) => {
            const target = targetFor(chatId);
            return target ? [target] : [];
        }),
        muted: listMutedChannelIds(agentId, db).flatMap((chatId) => {
            const target = targetFor(chatId);
            return target ? [target] : [];
        }),
        rows: collectInboxTargetSummaries(agentId, db).map(({ chatId: _chatId, ...row }) => row),
    };
}
