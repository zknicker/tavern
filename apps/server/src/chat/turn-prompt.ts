import { TavernApiError } from '@tavern/sdk';
import { createTavernClientForConnection } from '../agent-runtime/drivers.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export interface ChatTurnPromptEvidence {
    capturedAt: string;
    instructions: string;
    prompt: string;
    recall: Array<{ path: string; score: number; snippet: string; title: string }>;
    runId: string;
}

/**
 * Runtime-owned prompt evidence for one agent turn: the composed instructions,
 * the per-turn prompt, and the Wiki recall hits injected into it. Null when
 * no Runtime is connected or the turn has no captured evidence.
 */
export async function getChatTurnPrompt(runId: string): Promise<ChatTurnPromptEvidence | null> {
    const connection = await getActiveAgentRuntimeConnection();
    if (!(connection?.enabled && connection.baseUrl)) {
        return null;
    }

    const client = createTavernClientForConnection(connection);
    try {
        const evidence = await client.chat.turnPrompt(runId);
        return {
            capturedAt: evidence.captured_at,
            instructions: evidence.instructions,
            prompt: evidence.prompt,
            recall: evidence.recall,
            runId: evidence.run_id,
        };
    } catch (error) {
        if (error instanceof TavernApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}
