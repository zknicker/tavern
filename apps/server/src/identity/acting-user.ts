import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import type { ApiContext } from '../api/context.ts';

export const keylessActingUserId = 'usr_tavern';

const cacheTtlMs = 45_000;
const actingUserCache = new Map<string, { expiresAt: number; userId: string }>();

export async function resolveActingUserId(
    ctx: Pick<ApiContext, 'clerkSessionToken'>
): Promise<string> {
    const token = ctx.clerkSessionToken;
    if (!token) {
        return keylessActingUserId;
    }

    const now = Date.now();
    pruneExpiredEntries(now);
    const cached = actingUserCache.get(token);
    if (cached) {
        return cached.userId;
    }

    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Unable to resolve the acting Tavern user: Runtime is not connected.');
    }

    try {
        const me = await client.getIdentityMe(token);
        actingUserCache.set(token, {
            expiresAt: now + cacheTtlMs,
            userId: me.user.id,
        });
        return me.user.id;
    } catch (cause) {
        throw new Error('Unable to resolve the acting Tavern user from Runtime.', { cause });
    } finally {
        client.close();
    }
}

function pruneExpiredEntries(now: number) {
    for (const [token, cached] of actingUserCache) {
        if (cached.expiresAt <= now) {
            actingUserCache.delete(token);
        }
    }
}
