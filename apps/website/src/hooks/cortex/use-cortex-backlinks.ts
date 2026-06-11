import { trpc } from '../../lib/trpc.tsx';

export function useCortexBacklinks(page: { path: string; topic: string } | null) {
    return trpc.cortex.backlinks.useQuery(
        { path: page?.path ?? '', topic: page?.topic ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}
