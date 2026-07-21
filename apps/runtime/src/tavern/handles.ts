import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';

const handlePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u;

export const reservedHandles = new Set([
    'agent',
    'agents',
    'all',
    'busy',
    'everyone',
    'grotto',
    'here',
    'human',
    'humans',
    'idle',
    'system',
]);

export class HandleValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HandleValidationError';
    }
}

export function normalizeHandle(handle: string): string {
    return handle.toLowerCase();
}

export function isValidHandle(handle: string): boolean {
    return handlePattern.test(handle) && !reservedHandles.has(normalizeHandle(handle));
}

export function assertValidHandle(handle: string, label = 'Handle'): void {
    if (!handlePattern.test(handle)) {
        throw new HandleValidationError(
            `${label} must be 1-32 characters and use only letters, numbers, underscores, or hyphens.`
        );
    }
    if (reservedHandles.has(normalizeHandle(handle))) {
        throw new HandleValidationError(`${label} "${handle}" is reserved.`);
    }
}

export function assertParticipantHandleAvailable(
    handle: string,
    excludedParticipantId: string | null,
    db: Database
): void {
    assertValidHandle(handle, 'Participant handle');
    const row = db
        .prepare(
            `SELECT id FROM (
               SELECT id FROM agents WHERE lower(name) = lower($handle)
               UNION ALL
               SELECT id FROM identity_users WHERE name IS NOT NULL AND lower(name) = lower($handle)
               UNION ALL
               SELECT DISTINCT id FROM chat_participants
               WHERE kind IN ('user', 'external')
                 AND label IS NOT NULL
                 AND lower(label) = lower($handle)
             )
             WHERE ($excludedId IS NULL OR id != $excludedId)
             LIMIT 1`
        )
        .get(namedParams({ excludedId: excludedParticipantId, handle })) as { id: string } | null;
    if (row) {
        throw new HandleValidationError(`Participant handle "${handle}" is already in use.`);
    }
}

/**
 * Distinct agent ids can sanitize to the same participant seat
 * (`createAgentParticipantId` collapses non-token chars and agt_ prefixes);
 * membership and authorization key on the seat, so the seat must be unique.
 */
export function assertParticipantSeatAvailable(agentId: string, db: Database): void {
    const seat = createAgentParticipantId(agentId);
    const rows = db
        .prepare('SELECT id FROM agents WHERE id != $agentId')
        .all(namedParams({ agentId })) as Array<{ id: string }>;
    const collision = rows.find((row) => createAgentParticipantId(row.id) === seat);
    if (collision) {
        throw new HandleValidationError(
            `Agent id "${agentId}" collides with existing agent "${collision.id}" on participant seat "${seat}".`
        );
    }
}

export function assertChannelHandleAvailable(
    handle: string,
    excludedChatId: string | null,
    db: Database
): void {
    assertValidHandle(handle, 'Channel handle');
    const row = db
        .prepare(
            `SELECT id FROM chats
             WHERE kind = 'channel'
               AND lower(title) = lower($handle)
               AND ($excludedId IS NULL OR id != $excludedId)
             LIMIT 1`
        )
        .get(namedParams({ excludedId: excludedChatId, handle })) as { id: string } | null;
    if (row) {
        throw new HandleValidationError(`Channel handle "${handle}" is already in use.`);
    }
}
