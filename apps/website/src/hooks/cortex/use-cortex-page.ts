import { trpc } from '../../lib/trpc.tsx';

export function useCortexPage(page: { path: string; topic: string } | null) {
    return trpc.cortex.get.useQuery(
        { path: page?.path ?? '', topic: page?.topic ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}

export function useCortexPageSuspense(page: { path: string; topic: string }) {
    return trpc.cortex.get.useSuspenseQuery(page);
}
