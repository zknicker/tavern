import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { clerkFrontendOrigin } from './clerk-session.ts';
import { addMember, getOwner } from './members.ts';
import { getOrCreateUserByClerkId } from './users.ts';

export type ClaimOutcome =
    | { alreadyOwner: boolean; ok: true; userId: string }
    | { ok: false; reason: 'claimed-by-other' | 'invalid-key' };

/**
 * Explicit host-side ownership claim (`tavern claim`). Binds this runtime to
 * one Clerk user and validates the publishable key that verification will
 * use. Idempotent for the same user; refuses to steal a claimed runtime —
 * greenfield resets are done by deleting the runtime database, not by
 * reassigning owners.
 */
export function claimRuntimeForClerkUser(
    input: { clerkUserId: string; publishableKey: string },
    db: Database = getDb()
): ClaimOutcome {
    if (!clerkFrontendOrigin(input.publishableKey)) {
        return { ok: false, reason: 'invalid-key' };
    }
    const user = getOrCreateUserByClerkId(input.clerkUserId, db);
    const owner = getOwner(db);
    if (owner) {
        return owner.user.clerkUserId === input.clerkUserId
            ? { alreadyOwner: true, ok: true, userId: user.id }
            : { ok: false, reason: 'claimed-by-other' };
    }
    addMember(user.id, 'owner', db);
    return { alreadyOwner: false, ok: true, userId: user.id };
}
