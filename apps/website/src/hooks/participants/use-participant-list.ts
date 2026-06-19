import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useParticipantList() {
    return trpc.participant.list.useQuery(undefined, queryPolicy.localConfig);
}
