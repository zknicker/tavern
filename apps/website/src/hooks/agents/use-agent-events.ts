import { trpc } from '../../lib/trpc.tsx';

export function useAgentEvents() {
    const utils = trpc.useUtils();
    const handlers = createAgentEventHandlers(utils);

    trpc.agent.onUpdate.useSubscription(undefined, {
        onData: handlers.onAgentUpdate,
    });

    trpc.agent.onInstructionsUpdate.useSubscription(undefined, {
        onData: handlers.onAgentInstructionsUpdate,
    });
}

type AgentEventUtils = Pick<ReturnType<typeof trpc.useUtils>, 'agent' | 'chat'>;

export function createAgentEventHandlers(utils: AgentEventUtils) {
    return {
        onAgentInstructionsUpdate: (event: unknown) => {
            const agentId = readStringField(event, 'agentId');

            if (!agentId) {
                void utils.agent.instructions.invalidate(undefined, { exact: false });
                return;
            }

            void utils.agent.instructions.invalidate({ agentId });
        },
        onAgentUpdate: () => {
            void utils.agent.activity.invalidate();
            void utils.agent.get.invalidate(undefined, { exact: false });
            void utils.agent.list.invalidate();
            void utils.agent.primary.invalidate();
            void utils.chat.list.invalidate();
        },
    };
}

function readStringField(input: unknown, field: string) {
    if (!(input && typeof input === 'object' && field in input)) {
        return null;
    }

    const value = (input as Record<string, unknown>)[field];

    return typeof value === 'string' ? value : null;
}
