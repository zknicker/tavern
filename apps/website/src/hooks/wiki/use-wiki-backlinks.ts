import { trpc } from '../../lib/trpc.tsx';

export function useWikiBacklinks(page: { path: string } | null) {
    return trpc.wiki.backlinks.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}
