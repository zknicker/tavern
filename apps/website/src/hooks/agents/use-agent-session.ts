import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

/** The agent seat's current Agent session in one chat. */
export function useAgentSession({
    agentId,
    chatId,
    enabled = true,
}: {
    agentId: string;
    chatId: string;
    enabled?: boolean;
}) {
    return trpc.agent.session.useQuery(
        { agentId, chatId },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: enabled && agentId.length > 0 && chatId.length > 0,
        }
    );
}

/**
 * Starts a fresh Agent session for the seat. The chat timeline is untouched;
 * the reset lands as a durable new-session notice row, so the chat log and
 * session snapshot both refetch.
 */
export function useAgentSessionReset() {
    const utils = trpc.useUtils();

    return trpc.agent.resetSession.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.session.invalidate().catch(() => undefined),
                utils.chat.log.list.invalidate().catch(() => undefined),
            ]);
        },
    });
}
