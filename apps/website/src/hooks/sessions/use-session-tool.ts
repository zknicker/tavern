import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSessionTool(
    input: { sessionKey: string; toolCallId: string },
    options?: { enabled?: boolean }
) {
    return trpc.session.tool.get.useQuery(input, {
        ...queryPolicy.syncedSnapshot,
        ...options,
    });
}
