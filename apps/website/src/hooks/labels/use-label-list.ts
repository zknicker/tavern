import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useLabelList() {
    return trpc.label.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}
