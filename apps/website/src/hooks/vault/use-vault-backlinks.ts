import { trpc } from '../../lib/trpc.tsx';

export function useVaultBacklinks(page: { path: string } | null) {
    return trpc.vault.backlinks.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}
