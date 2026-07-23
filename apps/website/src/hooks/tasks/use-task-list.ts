import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useTaskList(chatId?: string) {
    // Always pass an object: tRPC's POST override sends an empty body for
    // undefined input, which optional-input procedures reject as bad JSON.
    return trpc.task.list.useQuery(chatId ? { chatId } : {}, queryPolicy.syncedSnapshot);
}
