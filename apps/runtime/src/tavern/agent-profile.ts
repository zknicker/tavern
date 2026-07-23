import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { getStoredAgent, updateStoredAgent } from './agents-store.ts';

export const agentProfileUpdateRequestSchema = z
    .object({ description: z.string().trim().min(1).max(500) })
    .strict();

export function readAgentProfile(agentId: string, target?: string | null, db: Database = getDb()) {
    if (!target) {
        const self = getStoredAgent(agentId, db);
        if (!self) {
            throw profileNotFound(`Agent ${agentId} was not found.`);
        }
        return { profile: { description: self.bio ?? null, handle: self.name, isSelf: true } };
    }
    const match = /^@([A-Za-z0-9][A-Za-z0-9_-]{0,31})$/u.exec(target);
    if (!match?.[1]) {
        throw new AgentApiError('INVALID_ARG', 'Profile target must be an @handle.', 400);
    }
    const rows = db
        .prepare(
            `SELECT id, name AS handle, 'agent' AS kind
             FROM agents WHERE lower(name) = lower($handle)
             UNION ALL
             SELECT id, name AS handle, 'human' AS kind
             FROM identity_users WHERE name IS NOT NULL AND lower(name) = lower($handle)`
        )
        .all(namedParams({ handle: match[1] })) as Array<{
        handle: string;
        id: string;
        kind: 'agent' | 'human';
    }>;
    if (rows.length !== 1) {
        throw profileNotFound(`Profile ${target} was not found.`);
    }
    const row = rows[0];
    if (!row) {
        throw profileNotFound(`Profile ${target} was not found.`);
    }
    const agent = row.kind === 'agent' ? getStoredAgent(row.id, db) : null;
    return {
        profile: {
            description: agent?.bio ?? null,
            handle: row.handle,
            isSelf: row.kind === 'agent' && row.id === agentId,
        },
    };
}

export function updateAgentProfile(
    agentId: string,
    input: z.infer<typeof agentProfileUpdateRequestSchema>,
    db: Database = getDb()
) {
    const agent = updateStoredAgent({ agentId, bio: input.description, db });
    if (!agent) {
        throw profileNotFound(`Agent ${agentId} was not found.`);
    }
    return { profile: { description: agent.bio ?? null, handle: agent.name, isSelf: true } };
}

function profileNotFound(message: string) {
    return new AgentApiError('TARGET_NOT_FOUND', message, 404);
}
