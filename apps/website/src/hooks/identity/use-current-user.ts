import { isClerkEnabled } from '../../lib/clerk.tsx';
import { trpc } from '../../lib/trpc.tsx';

const currentUserStaleTimeMs = 5 * 60 * 1000;

export function useCurrentUser() {
    const query = trpc.identity.me.useQuery(undefined, {
        enabled: isClerkEnabled,
        staleTime: currentUserStaleTimeMs,
    });
    const user = query.data?.user ?? null;

    return {
        role: query.data?.role ?? null,
        tavernUserId: user?.id ?? null,
        user,
    };
}
