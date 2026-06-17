import { trpc } from '../../lib/trpc.tsx';

export function useVaultPage(page: { path: string } | null) {
    return trpc.vault.get.useQuery(
        { path: page?.path ?? '' },
        {
            enabled: Boolean(page),
        }
    );
}

export function useVaultPageSuspense(page: { path: string }) {
    return trpc.vault.get.useSuspenseQuery(page);
}
