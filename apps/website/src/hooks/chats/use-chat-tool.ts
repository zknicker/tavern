import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useChatTool(
    input: { activityId: string; chatId: string },
    options?: { enabled?: boolean }
) {
    return trpc.chat.tool.get.useQuery(input, {
        ...queryPolicy.syncedSnapshot,
        ...options,
    });
}
