import { trpc } from '../../lib/trpc.tsx';

export function useCortexStatusSuspense() {
    return trpc.cortex.status.useSuspenseQuery();
}
