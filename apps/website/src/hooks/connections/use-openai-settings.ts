import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useOpenAiSettings() {
    return trpc.openAiSettings.get.useQuery(undefined, queryPolicy.localConfig);
}
