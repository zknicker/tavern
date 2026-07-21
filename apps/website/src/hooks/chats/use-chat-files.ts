import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useChatFiles(chatId: string, options: { enabled: boolean }) {
    return trpc.chat.files.list.useQuery(
        { chatId },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: options.enabled,
            refetchOnMount: 'always',
        }
    );
}
