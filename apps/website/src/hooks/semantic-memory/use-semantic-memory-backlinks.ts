import { trpc } from '../../lib/trpc.tsx';

export function useSemanticMemoryBacklinks(page: { path: string } | null) {
    return trpc.semanticMemory.backlinks.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}
