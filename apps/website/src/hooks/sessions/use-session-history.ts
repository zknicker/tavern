import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSessionHistory(
    input: { sessionKey: string; limit?: number; offset?: number },
    options?: { enabled?: boolean }
) {
    return trpc.session.history.get.useQuery(
        {
            limit: input.limit ?? 10,
            offset: input.offset,
            sessionKey: input.sessionKey,
        },
        {
            enabled: options?.enabled,
            ...queryPolicy.syncedSnapshot,
        }
    );
}
