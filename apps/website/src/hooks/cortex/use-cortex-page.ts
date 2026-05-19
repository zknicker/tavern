import { trpc } from '../../lib/trpc.tsx';

export function useCortexPageSuspense(slugOrId: string) {
    return trpc.cortex.get.useSuspenseQuery({ slugOrId });
}
