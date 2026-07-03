import { trpc } from '../../lib/trpc.tsx';

export function useSemanticMemoryPage(page: { path: string } | null) {
    return trpc.semanticMemory.get.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}

export function useSemanticMemoryPageSuspense(page: { path: string }) {
    return trpc.semanticMemory.get.useSuspenseQuery(page);
}
