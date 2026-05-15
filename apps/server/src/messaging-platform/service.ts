import type { AgentRuntimeUpsertBinding } from '@tavern/agent-runtime-protocol';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import {
    deleteAgentRuntimeBinding,
    listAgentRuntimeBindings,
    saveAgentRuntimeBinding,
} from '../agent-runtime/platforms.ts';
import { listConfiguredAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import {
    deleteStoredMessagingBinding,
    listStoredMessagingBindings,
    saveStoredMessagingBinding,
} from '../storage/messaging-bindings.ts';

export async function syncMessagingBindingsToAgentRuntime() {
    const runtimes = await listConfiguredAgentRuntimeConnections();

    if (runtimes.length === 0) {
        return;
    }

    const localBindings = await listStoredMessagingBindings();

    await Promise.all(
        runtimes.map(async (runtime) => {
            const client = createAgentRuntimeClientForConnection(runtime);
            const agentRuntimeBindings = await listAgentRuntimeBindings(client);
            const localById = new Map(
                localBindings.map((binding) => [binding.id, binding] as const)
            );

            await Promise.all(
                localBindings.map((binding) => saveAgentRuntimeBinding(binding, client))
            );

            await Promise.all(
                agentRuntimeBindings
                    .filter((binding) => !localById.has(binding.id))
                    .map((binding) => deleteAgentRuntimeBinding(binding.id, client))
            );
        })
    );
}

export async function listMessagingBindings() {
    return await listStoredMessagingBindings();
}

export async function saveMessagingBinding(input: AgentRuntimeUpsertBinding) {
    const saved = await saveStoredMessagingBinding(input);
    await syncMessagingBindingsToAgentRuntime();
    return saved;
}

export async function deleteMessagingBinding(bindingId: string) {
    const deleted = await deleteStoredMessagingBinding(bindingId);

    if (!deleted) {
        return {
            archived: true as const,
            id: bindingId,
        };
    }

    await syncMessagingBindingsToAgentRuntime();

    return {
        archived: true as const,
        id: bindingId,
    };
}
