import { trpc } from '../../lib/trpc.tsx';

export function useWikiPage(page: { path: string } | null) {
    return trpc.wiki.get.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}

export function useWikiPageSuspense(page: { path: string }) {
    return trpc.wiki.get.useSuspenseQuery(page);
}
