import { trpc } from '../../lib/trpc.tsx';

/**
 * Per-agent web access rides the agent record, so a successful save refreshes
 * the agent lists that surface it.
 */
export function useAgentWebSettingsUpdate() {
    const utils = trpc.useUtils();

    return trpc.agent.updateWebSettings.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.agent.list.invalidate(), utils.agent.primary.invalidate()]);
        },
    });
}
