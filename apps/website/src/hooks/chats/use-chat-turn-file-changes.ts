import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

// One turn's workspace file-change evidence (before/after contents), fetched
// on demand when the changed-files drawer opens.
export function useChatTurnFileChanges(input: { runId: string }, options?: { enabled?: boolean }) {
    return trpc.chat.turn.fileChanges.useQuery(input, {
        ...queryPolicy.syncedSnapshot,
        ...options,
    });
}
