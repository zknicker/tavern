import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useChatStatus() {
    return trpc.chat.status.list.useQuery(undefined, queryPolicy.volatileState);
}
