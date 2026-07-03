import { trpc } from '../../lib/trpc.tsx';

export function useSemanticMemoryListSuspense() {
    return trpc.semanticMemory.list.useSuspenseQuery();
}
