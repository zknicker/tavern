import { randomUUID } from 'node:crypto';
import type { TavernChat, TavernChatMessage } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError, targetNotFound } from './agent-api-errors.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    AmbiguousMessageIdError,
    anchorShortId,
    createChat,
    ensureThreadChat,
    getChat,
    resolveMessageId,
    threadChatIdForAnchor,
} from './chat-api/index.ts';
import { isAgentChatParticipant, isArchivedChat } from './chat-guards.ts';
import { isValidHandle } from './handles.ts';

export interface ResolvedAgentTarget {
    chat: TavernChat;
    target: string;
}

interface ParticipantHandleRow {
    handle: string;
    id: string;
    kind: 'agent' | 'external' | 'user';
}

export function resolveAgentTarget(
    input: {
        agentId: string;
        createDm?: boolean;
        // Sends materialize a missing thread (first reply creates); reads
        // never do, and never apply write policy such as archival.
        createThread?: boolean;
        requireMembership?: boolean;
        target: string;
    },
    db: Database = getDb()
): ResolvedAgentTarget {
    const threadMatch = /^(#[^:]+|dm:@[^:]+):([A-Za-z0-9_-]+)$/u.exec(input.target);
    if (threadMatch?.[1] && threadMatch[2]) {
        return resolveThread(input, threadMatch[1], threadMatch[2], db);
    }
    const channelMatch = /^#([A-Za-z0-9][A-Za-z0-9_-]{0,31})$/u.exec(input.target);
    if (channelMatch?.[1]) {
        return resolveChannel(input.agentId, channelMatch[1], input.requireMembership ?? true, db);
    }
    const dmMatch = /^dm:@([A-Za-z0-9][A-Za-z0-9_-]{0,31})$/u.exec(input.target);
    if (dmMatch?.[1]) {
        return resolveDm(input.agentId, dmMatch[1], input.createDm ?? false, db);
    }
    throw targetNotFound(`Invalid target "${input.target}".`);
}

export function formatAgentTarget(
    agentId: string,
    chat: TavernChat,
    db: Database = getDb()
): string | null {
    if (chat.kind === 'channel') {
        return chat.title && isValidHandle(chat.title) ? `#${chat.title}` : null;
    }
    if (chat.kind === 'thread') {
        const parent = chat.parent_chat_id ? getChat(chat.parent_chat_id, db) : null;
        const parentTarget = parent ? formatAgentTarget(agentId, parent, db) : null;
        return parentTarget && chat.anchor_message_id
            ? `${parentTarget}:${anchorShortId(chat.anchor_message_id)}`
            : null;
    }
    if (chat.kind !== 'dm') {
        return null;
    }
    const callerParticipantId = createAgentParticipantId(agentId);
    const caller = chat.participants.find(
        (participant) =>
            participant.id === callerParticipantId || participant.metadata.agentId === agentId
    );
    const peers = chat.participants.filter((participant) => participant !== caller);
    if (!caller || peers.length !== 1) {
        return null;
    }
    const peer = peers[0];
    if (!peer) {
        return null;
    }
    const metadataAgentId = peer.metadata.agentId;
    const peerAgentId =
        typeof metadataAgentId === 'string'
            ? metadataAgentId
            : peer.kind === 'agent'
              ? peer.id
              : null;
    const handle = (peerAgentId ? getStoredAgent(peerAgentId, db)?.name : null) ?? peer.label;
    return handle && isValidHandle(handle) ? `dm:@${handle}` : null;
}

// A thread target is its parent target plus the anchor's message id (short
// or full). Membership rides the parent resolution; a SEND auto-creates the
// thread exactly like a first reply, while reads only resolve what exists.
function resolveThread(
    input: {
        agentId: string;
        createThread?: boolean;
        requireMembership?: boolean;
        target: string;
    },
    parentTarget: string,
    anchorRef: string,
    db: Database
): ResolvedAgentTarget {
    const parent = resolveAgentTarget(
        {
            agentId: input.agentId,
            createDm: false,
            requireMembership: input.requireMembership,
            target: parentTarget,
        },
        db
    );
    if (input.createThread && isArchivedChat(parent.chat)) {
        throw new AgentApiError(
            'TARGET_ARCHIVED',
            `${parent.target} is archived; writes there are rejected.`,
            409
        );
    }
    let anchor: TavernChatMessage | null;
    try {
        anchor = resolveMessageId(anchorRef, { chatId: parent.chat.id }, db);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            throw new AgentApiError('AMBIGUOUS_ID', error.message, 409);
        }
        throw error;
    }
    if (!anchor) {
        throw targetNotFound(`No message "${anchorRef}" in ${parent.target}.`);
    }
    const target = `${parent.target}:${anchorShortId(anchor.id)}`;
    if (!input.createThread) {
        const existing = getChat(threadChatIdForAnchor(anchor.id), db);
        if (existing?.kind !== 'thread' || existing.parent_chat_id !== parent.chat.id) {
            throw targetNotFound(
                `No thread exists on that message yet. Sending to ${target} starts it.`
            );
        }
        return { chat: existing, target };
    }
    try {
        const thread = ensureThreadChat(
            { anchorMessageId: anchor.id, parentChatId: parent.chat.id },
            db
        );
        return { chat: thread, target };
    } catch (error) {
        throw new AgentApiError(
            'SEND_FAILED',
            error instanceof Error ? error.message : 'Thread target could not be resolved.',
            409
        );
    }
}

function resolveChannel(
    agentId: string,
    handle: string,
    requireMembership: boolean,
    db: Database
): ResolvedAgentTarget {
    const rows = db
        .prepare(`SELECT id FROM chats WHERE kind = 'channel' AND lower(title) = lower($handle)`)
        .all(namedParams({ handle })) as Array<{ id: string }>;
    if (rows.length !== 1) {
        throw targetNotFound(`Channel #${handle} was not found.`);
    }
    const chat = getChat(rows[0]?.id ?? '', db);
    if (!chat) {
        throw targetNotFound(`Channel #${handle} was not found.`);
    }
    if (requireMembership) {
        assertMembership(agentId, chat);
    }
    return { chat, target: `#${chat.title}` };
}

function resolveDm(
    agentId: string,
    handle: string,
    createDm: boolean,
    db: Database
): ResolvedAgentTarget {
    const peers = listParticipantHandles(handle, db).filter((peer) => peer.id !== agentId);
    if (peers.length !== 1) {
        throw targetNotFound(`Participant @${handle} was not found.`);
    }
    const peer = peers[0];
    if (!peer) {
        throw targetNotFound(`Participant @${handle} was not found.`);
    }
    const callerParticipantId = createAgentParticipantId(agentId);
    // Agent peers are addressed by their participant seat, not their raw id.
    const peerParticipantId = peer.kind === 'agent' ? createAgentParticipantId(peer.id) : peer.id;
    const dmRows = db
        .prepare(
            `SELECT chats.id
             FROM chats
             JOIN chat_participants caller ON caller.chat_id = chats.id
             JOIN chat_participants peer ON peer.chat_id = chats.id
             WHERE chats.kind = 'dm'
               AND caller.id = $callerId
               AND peer.id = $peerId`
        )
        .all(namedParams({ callerId: callerParticipantId, peerId: peerParticipantId })) as Array<{
        id: string;
    }>;
    if (dmRows.length > 1) {
        throw targetNotFound(`DM with @${handle} could not be resolved uniquely.`);
    }
    const dmRow = dmRows[0];
    if (dmRow) {
        const chat = getChat(dmRow.id, db);
        if (chat) {
            return { chat, target: `dm:@${peer.handle}` };
        }
    }
    if (!createDm) {
        throw targetNotFound(`DM with @${handle} was not found.`);
    }
    const caller = getStoredAgent(agentId, db);
    if (!caller) {
        throw targetNotFound('Calling agent was not found.');
    }
    const chat = createChat(
        {
            id: `cht_${randomUUID().replaceAll('-', '')}`,
            kind: 'dm',
            participants: [
                {
                    id: callerParticipantId,
                    kind: 'agent',
                    label: caller.name,
                    metadata: { agentId, source: 'tavern' },
                },
                {
                    id: peerParticipantId,
                    kind: peer.kind,
                    label: peer.handle,
                    metadata:
                        peer.kind === 'agent'
                            ? { agentId: peer.id, source: 'tavern' }
                            : { source: 'tavern' },
                },
            ],
            title: peer.handle,
        },
        db
    );
    return { chat, target: `dm:@${peer.handle}` };
}

function listParticipantHandles(handle: string, db: Database): ParticipantHandleRow[] {
    const rows = db
        .prepare(
            `SELECT id, name AS handle, 'agent' AS kind
             FROM agents WHERE lower(name) = lower($handle)
             UNION ALL
             SELECT id, name AS handle, 'user' AS kind
             FROM identity_users WHERE name IS NOT NULL AND lower(name) = lower($handle)
             UNION ALL
             SELECT id, label AS handle,
                    CASE WHEN kind = 'external' THEN 'external' ELSE 'user' END AS kind
             FROM chat_participants
             WHERE kind IN ('user', 'external')
               AND label IS NOT NULL AND lower(label) = lower($handle)`
        )
        .all(namedParams({ handle })) as ParticipantHandleRow[];
    const byId = new Map<string, ParticipantHandleRow>();
    for (const row of rows) {
        byId.set(row.id, row);
    }
    return [...byId.values()];
}

function assertMembership(agentId: string, chat: TavernChat): void {
    if (!isAgentChatParticipant(chat, agentId, createAgentParticipantId(agentId))) {
        throw new AgentApiError(
            'NOT_A_MEMBER',
            'The calling agent is not a member of that target.',
            403
        );
    }
}
