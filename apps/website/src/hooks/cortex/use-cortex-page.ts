import { trpc } from '../../lib/trpc.tsx';

export function useCortexPage(slugOrId: string | null) {
    return trpc.cortex.get.useQuery(
        { slugOrId: slugOrId ?? '' },
        {
            enabled: Boolean(slugOrId),
        }
    );
}

export function useCortexPageSuspense(slugOrId: string) {
    return trpc.cortex.get.useSuspenseQuery({ slugOrId });
}
