import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

const fallbackJobSlug = 'sync-openrouter-usage';

export function useJobGet(slug: string | null) {
    return trpc.jobs.get.useQuery(
        { slug: slug ?? fallbackJobSlug },
        {
            enabled: slug !== null,
            ...queryPolicy.syncedSnapshot,
        }
    );
}

export function useJobGetSuspense(slug: string) {
    return trpc.jobs.get.useSuspenseQuery({ slug }, queryPolicy.syncedSnapshot);
}
