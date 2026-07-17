import type { RuntimeMemberRole, RuntimeUser } from '@tavern/api';
import { runtimeRoutes } from '@tavern/api';
import { getConfiguredClerkVerifier } from './clerk-session.ts';
import { claimOwnershipIfUnclaimed, getMemberRole } from './members.ts';
import { getOrCreateUserByClerkId } from './users.ts';

/**
 * Who a runtime request is acting as. The runtime token is the owner's
 * transport credential and bypasses membership; Clerk-verified users carry
 * their member role (null until they redeem an invite).
 */
export type RuntimeRequestAuth =
    | { kind: 'runtime-token' }
    | { kind: 'user'; role: RuntimeMemberRole | null; user: RuntimeUser };

/**
 * Resolves a Clerk bearer token to a user. Returns null when the token does
 * not verify (or Clerk is not configured). The first verified user to reach
 * an unclaimed runtime becomes its owner (specs/identity.md).
 */
export async function resolveClerkRequestAuth(
    bearerToken: string
): Promise<RuntimeRequestAuth | null> {
    const verifier = getConfiguredClerkVerifier();
    if (!verifier) {
        return null;
    }
    let clerkUserId: string;
    try {
        ({ clerkUserId } = await verifier.verify(bearerToken));
    } catch {
        return null;
    }
    const user = getOrCreateUserByClerkId(clerkUserId);
    claimOwnershipIfUnclaimed(user.id);
    return { kind: 'user', role: getMemberRole(user.id), user };
}

const nonMemberAllowedRoutes = new Set<string>([
    runtimeRoutes.identityMe,
    runtimeRoutes.identityInviteRedeem,
]);

/** Verified non-members may only introspect themselves and redeem invites. */
export function isRouteAllowedForAuth(auth: RuntimeRequestAuth, pathname: string): boolean {
    if (auth.kind === 'runtime-token' || auth.role !== null) {
        return true;
    }
    return nonMemberAllowedRoutes.has(pathname);
}
