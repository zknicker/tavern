import { devToolkitScenarioSchema } from '@tavern/api';
import { z } from 'zod';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export const simulateTurnInputSchema = z.object({
    chatId: z.string().trim().min(1),
    scenario: devToolkitScenarioSchema.default('tooling'),
});

/**
 * Dev toolkit: asks Runtime to run a scripted streaming turn in a chat.
 * Runtime rejects this outside the development stack (devToolkit capability).
 */
export async function simulateChatTurn(input: z.infer<typeof simulateTurnInputSchema>) {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Tavern Runtime is not connected.');
    }

    const client = createTavernClientForConnection(connection);
    const receipt = await client.dev.simulateTurn({
        chat_id: input.chatId,
        scenario: input.scenario,
    });

    return { responseId: receipt.response_id, runId: receipt.run_id };
}
