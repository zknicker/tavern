import { trpc } from '../../lib/trpc.tsx';

export function usePollModelProviderOAuth(
    input: { providerId: string; sessionId: string } | null,
    options?: { enabled?: boolean; refetchInterval?: number }
) {
    return trpc.modelAccess.pollProviderOAuth.useQuery(input ?? { providerId: '', sessionId: '' }, {
        enabled: Boolean(input) && (options?.enabled ?? true),
        refetchInterval: options?.refetchInterval,
        retry: false,
    });
}
