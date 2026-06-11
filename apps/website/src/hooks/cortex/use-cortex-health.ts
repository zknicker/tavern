import { trpc } from '../../lib/trpc.tsx';

export function useCortexHealth() {
    return trpc.cortex.health.useQuery(undefined, {
        refetchInterval: 60_000,
    });
}
