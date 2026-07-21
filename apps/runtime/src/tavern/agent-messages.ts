import type { TavernChatMessage } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getStoredAgent } from './agents-store.ts';

export interface AgentMessage extends TavernChatMessage {
    sender: {
        description: string | null;
        handle: string | null;
        type: 'agent' | 'human' | 'system';
    };
}

export function toAgentMessage(message: TavernChatMessage, db: Database = getDb()): AgentMessage {
    const metadataAgentId = message.author.metadata.agentId;
    const agentId =
        typeof metadataAgentId === 'string'
            ? metadataAgentId
            : message.author.kind === 'agent'
              ? message.author.id
              : null;
    const agent = agentId ? getStoredAgent(agentId, db) : null;
    return {
        ...message,
        sender: {
            description: agent?.bio ?? null,
            handle: agent?.name ?? message.author.label,
            type: senderType(message),
        },
    };
}

export function countFormalMentions(
    messages: TavernChatMessage[],
    input: { agentId: string; handle: string }
): number {
    const richReference = new RegExp(`agent://${escapeRegExp(input.agentId)}(?:[)\\s]|$)`, 'iu');
    const plainMention = new RegExp(
        `(^|[^A-Za-z0-9_-])@${escapeRegExp(input.handle)}(?![A-Za-z0-9_-])`,
        'iu'
    );
    return messages.filter(
        (message) => richReference.test(message.content) || plainMention.test(message.content)
    ).length;
}

export function senderIdForHandle(handle: string, db: Database = getDb()): string | null {
    const rows = db
        .prepare(
            `SELECT id FROM agents WHERE lower(name) = lower($handle)
             UNION ALL
             SELECT id FROM identity_users WHERE name IS NOT NULL AND lower(name) = lower($handle)
             UNION ALL
             SELECT DISTINCT id FROM chat_participants
             WHERE label IS NOT NULL AND lower(label) = lower($handle)`
        )
        .all(namedParams({ handle })) as Array<{ id: string }>;
    const ids = [...new Set(rows.map((row) => row.id))];
    return ids.length === 1 ? (ids[0] ?? null) : null;
}

function senderType(message: TavernChatMessage): AgentMessage['sender']['type'] {
    if (message.author.kind === 'agent') {
        return 'agent';
    }
    if (message.author.kind === 'system' || message.author.kind === 'plugin') {
        return 'system';
    }
    return 'human';
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
