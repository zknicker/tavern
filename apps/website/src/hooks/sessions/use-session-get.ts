import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSessionGet(input: { sessionKey: string; limit?: number; offset?: number }) {
    return trpc.session.get.useQuery(
        {
            limit: input.limit ?? 10,
            offset: input.offset ?? 0,
            sessionKey: input.sessionKey,
        },
        queryPolicy.syncedSnapshot
    );
}
