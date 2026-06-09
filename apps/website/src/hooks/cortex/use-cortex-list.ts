import { trpc } from '../../lib/trpc.tsx';

export function useCortexListSuspense(
    input: { includeArchived?: boolean; topic?: string | null } = {}
) {
    return trpc.cortex.list.useSuspenseQuery(input);
}

export function useCortexTopicsSuspense(input: { includeArchived?: boolean } = {}) {
    return trpc.cortex.topics.useSuspenseQuery(input);
}
