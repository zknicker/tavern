import { trpc } from '../../lib/trpc.tsx';

export function useCortexListSuspense() {
    return trpc.cortex.list.useSuspenseQuery();
}
