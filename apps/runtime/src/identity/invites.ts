import { randomBytes } from 'node:crypto';
import type { RuntimeInvite } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { addMember, getMemberRole } from './members.ts';

interface InviteRow {
    code: string;
    created_at: string;
    created_by: string;
    id: string;
    redeemed_at: string | null;
    redeemed_by: string | null;
}

export function createInvite(createdBy: string, db: Database = getDb()): RuntimeInvite {
    const now = new Date().toISOString();
    const row: InviteRow = {
        code: randomBytes(16).toString('base64url'),
        created_at: now,
        created_by: createdBy,
        id: `inv_${randomBytes(9).toString('base64url')}`,
        redeemed_at: null,
        redeemed_by: null,
    };
    db.prepare(
        `INSERT INTO identity_invites (id, code, created_by, created_at, redeemed_by, redeemed_at)
         VALUES ($id, $code, $createdBy, $createdAt, NULL, NULL)`
    ).run(
        namedParams({
            code: row.code,
            createdAt: row.created_at,
            createdBy: row.created_by,
            id: row.id,
        })
    );
    return toRuntimeInvite(row);
}

/** Single-use: the UPDATE only lands on an unredeemed row, so a raced second
 *  redeem of the same code fails cleanly. */
export function redeemInvite(
    code: string,
    userId: string,
    db: Database = getDb()
): { ok: true } | { ok: false; reason: 'invalid' | 'already-redeemed' | 'already-member' } {
    if (getMemberRole(userId, db) !== null) {
        return { ok: false, reason: 'already-member' };
    }
    const now = new Date().toISOString();
    let outcome: ReturnType<typeof redeemInvite> = { ok: true };
    const transaction = db.transaction(() => {
        const invite = db
            .prepare('SELECT * FROM identity_invites WHERE code = $code')
            .get(namedParams({ code })) as InviteRow | null;
        if (!invite) {
            outcome = { ok: false, reason: 'invalid' };
            return;
        }
        if (invite.redeemed_by !== null) {
            outcome = { ok: false, reason: 'already-redeemed' };
            return;
        }
        db.prepare(
            `UPDATE identity_invites
             SET redeemed_by = $userId, redeemed_at = $redeemedAt
             WHERE id = $id AND redeemed_by IS NULL`
        ).run(namedParams({ id: invite.id, redeemedAt: now, userId }));
        addMember(userId, 'member', db);
    });
    transaction();
    return outcome;
}

export function listInvites(db: Database = getDb()): RuntimeInvite[] {
    const rows = db
        .prepare('SELECT * FROM identity_invites ORDER BY created_at DESC')
        .all() as InviteRow[];
    return rows.map(toRuntimeInvite);
}

export function deleteInvite(id: string, db: Database = getDb()): void {
    db.prepare('DELETE FROM identity_invites WHERE id = $id AND redeemed_by IS NULL').run(
        namedParams({ id })
    );
}

function toRuntimeInvite(row: InviteRow): RuntimeInvite {
    return {
        code: row.code,
        createdAt: row.created_at,
        createdBy: row.created_by,
        id: row.id,
        redeemedAt: row.redeemed_at,
        redeemedBy: row.redeemed_by,
    };
}
