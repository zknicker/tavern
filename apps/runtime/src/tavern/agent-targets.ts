import { randomUUID } from 'node:crypto';
import type { TavernChat } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError, targetNotFound } from './agent-api-errors.ts';
import { getStoredAgent } from './agents-store.ts';
import { isAgentChatParticipant } from './chat-actions-tools.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { createChat, getChat } from './chat-api/index.ts';

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
        requireMembership?: boolean;
        target: string;
    },
    db: Database = getDb()
): ResolvedAgentTarget {
    const threadMatch = /^(?:#[^:]+|dm:@[^:]+):.+$/u.exec(input.target);
    if (threadMatch) {
        throw targetNotFound('Thread targets are not available yet; they land in WS3.');
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
        .all(namedParams({ callerId: callerParticipantId, peerId: peer.id })) as Array<{
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
                    id: peer.id,
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
