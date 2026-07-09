import { trpc } from '../../lib/trpc.tsx';

/**
 * Per-agent task settings (auto-dispatch + review policy) ride the agent
 * record, so a successful save refreshes the agent lists that surface them.
 */
export function useAgentTaskSettingsUpdate() {
    const utils = trpc.useUtils();

    return trpc.agent.updateTaskSettings.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.agent.list.invalidate(), utils.agent.primary.invalidate()]);
        },
    });
}
