import { trpc } from '../../lib/trpc.tsx';

export function useVaultListSuspense() {
    return trpc.vault.list.useSuspenseQuery();
}
