import { trpc } from '../../lib/trpc.tsx';

// Read-only Git history for one Wiki page: the commit list, then one
// commit's before/after content on demand when a revision row expands.
export function useWikiPageHistory(input: { path: string }, options?: { enabled?: boolean }) {
    return trpc.wiki.history.useQuery({ path: input.path }, options);
}

export function useWikiPageRevision(
    input: { commit: string; path: string },
    options?: { enabled?: boolean }
) {
    return trpc.wiki.revision.useQuery(input, options);
}
