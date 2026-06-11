import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '../../lib/trpc.tsx';

export interface ConnectAgentRuntimeInput {
    auth?: { token: string };
    baseUrl: string;
}

export function useConnectAgentRuntime(options?: { onSuccess?: () => Promise<void> | void }) {
    const queryClient = useQueryClient();

    return trpc.agentRuntime.connect.useMutation({
        onSettled: async () => {
            await queryClient.invalidateQueries();
        },
        onSuccess: async () => {
            await options?.onSuccess?.();
        },
    });
}
