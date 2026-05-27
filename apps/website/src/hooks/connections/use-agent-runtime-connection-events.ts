import { trpc } from '../../lib/trpc.tsx';

export function useAgentRuntimeConnectionEvents() {
    const utils = trpc.useUtils();

    trpc.agentRuntime.onUpdate.useSubscription(undefined, {
        onData: () => {
            utils.agentRuntime.get.invalidate().catch(() => undefined);
        },
    });
}

export function useAgentRuntimeCapabilityEvents() {
    const utils = trpc.useUtils();

    trpc.agentRuntime.onCapabilityUpdated.useSubscription(undefined, {
        onData: () => {
            utils.agentRuntime.get.invalidate().catch(() => undefined);
        },
    });
}
