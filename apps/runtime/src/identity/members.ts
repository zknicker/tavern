import type { RuntimeMember, RuntimeMemberRole } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { toRuntimeUser, type UserRow } from './users.ts';

interface MemberRow {
    created_at: string;
    role: RuntimeMemberRole;
    updated_at: string;
    user_id: string;
}

export function getMemberRole(userId: string, db: Database = getDb()): RuntimeMemberRole | null {
    const row = db
        .prepare('SELECT role FROM identity_members WHERE user_id = $userId')
        .get(namedParams({ userId })) as Pick<MemberRow, 'role'> | null;
    return row?.role ?? null;
}

export function hasOwner(db: Database = getDb()): boolean {
    const row = db.prepare("SELECT user_id FROM identity_members WHERE role = 'owner'").get();
    return row !== null && row !== undefined;
}

/**
 * First verified user to connect claims an unclaimed runtime. The partial
 * unique index on role='owner' makes concurrent claims race-safe: the loser
 * throws and re-reads.
 */
export function claimOwnershipIfUnclaimed(userId: string, db: Database = getDb()): void {
    if (hasOwner(db)) {
        return;
    }
    try {
        addMember(userId, 'owner', db);
    } catch {
        if (!hasOwner(db)) {
            throw new Error('Runtime ownership claim failed.');
        }
    }
}

export function addMember(userId: string, role: RuntimeMemberRole, db: Database = getDb()): void {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO identity_members (user_id, role, created_at, updated_at)
         VALUES ($userId, $role, $createdAt, $updatedAt)
         ON CONFLICT(user_id) DO NOTHING`
    ).run(namedParams({ createdAt: now, role, updatedAt: now, userId }));
}

export function removeMember(userId: string, db: Database = getDb()): void {
    const role = getMemberRole(userId, db);
    if (role === 'owner') {
        throw new Error('The runtime owner cannot be removed.');
    }
    db.prepare('DELETE FROM identity_members WHERE user_id = $userId').run(namedParams({ userId }));
}

export function getOwner(db: Database = getDb()): RuntimeMember | null {
    return listMembers(db).find((member) => member.role === 'owner') ?? null;
}

export function listMembers(db: Database = getDb()): RuntimeMember[] {
    const rows = db
        .prepare(
            `SELECT m.role AS member_role, m.created_at AS member_created_at, u.*
             FROM identity_members m
             JOIN identity_users u ON u.id = m.user_id
             ORDER BY m.created_at ASC`
        )
        .all() as (UserRow & { member_created_at: string; member_role: RuntimeMemberRole })[];
    return rows.map((row) => ({
        createdAt: row.member_created_at,
        role: row.member_role,
        user: toRuntimeUser(row),
    }));
}
