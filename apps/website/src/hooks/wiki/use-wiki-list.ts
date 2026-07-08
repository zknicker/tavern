import { trpc } from '../../lib/trpc.tsx';

export function useWikiListSuspense() {
    return trpc.wiki.list.useSuspenseQuery();
}
