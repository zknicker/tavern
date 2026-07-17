import { randomBytes } from 'node:crypto';
import type { RuntimeUser } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

interface UserRow {
    avatar_url: string | null;
    clerk_user_id: string;
    created_at: string;
    email: string | null;
    id: string;
    name: string | null;
    updated_at: string;
}

/**
 * Session JWTs carry only the Clerk user id; profile fields stay null until a
 * profile-enrichment path exists. Insert races resolve via the unique
 * clerk_user_id constraint and a re-read.
 */
export function getOrCreateUserByClerkId(clerkUserId: string, db: Database = getDb()): RuntimeUser {
    const existing = getUserRowByClerkId(clerkUserId, db);
    if (existing) {
        return toRuntimeUser(existing);
    }
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO identity_users (id, clerk_user_id, name, email, avatar_url, created_at, updated_at)
         VALUES ($id, $clerkUserId, NULL, NULL, NULL, $createdAt, $updatedAt)
         ON CONFLICT(clerk_user_id) DO NOTHING`
    ).run(
        namedParams({
            clerkUserId,
            createdAt: now,
            id: `usr_${randomBytes(12).toString('base64url')}`,
            updatedAt: now,
        })
    );
    const row = getUserRowByClerkId(clerkUserId, db);
    if (!row) {
        throw new Error('Identity user creation failed.');
    }
    return toRuntimeUser(row);
}

export function getUser(id: string, db: Database = getDb()): RuntimeUser | null {
    const row = db
        .prepare('SELECT * FROM identity_users WHERE id = $id')
        .get(namedParams({ id })) as UserRow | null;
    return row ? toRuntimeUser(row) : null;
}

function getUserRowByClerkId(clerkUserId: string, db: Database): UserRow | null {
    return db
        .prepare('SELECT * FROM identity_users WHERE clerk_user_id = $clerkUserId')
        .get(namedParams({ clerkUserId })) as UserRow | null;
}

export function toRuntimeUser(row: UserRow): RuntimeUser {
    return {
        avatarUrl: row.avatar_url,
        clerkUserId: row.clerk_user_id,
        createdAt: row.created_at,
        email: row.email,
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
    };
}

export type { UserRow };
