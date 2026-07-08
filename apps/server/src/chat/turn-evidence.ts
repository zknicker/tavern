import { z } from 'zod';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { listAgents } from '../agents/catalog.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { chatLogRowSchema } from './contracts.ts';
import {
    activityToChatRows,
    artifactToChatRow,
    messageText,
    runtimeMetadataString,
} from './runtime-chat-api.ts';

export const chatTurnEvidenceInputSchema = z.object({
    chatId: z.string().trim().min(1),
    responseId: z.string().trim().min(1),
});

export const chatTurnEvidenceSchema = z.object({
    response: z.object({
        completedAt: z.string().nullable(),
        id: z.string(),
        runId: z.string().nullable(),
        status: z.string(),
    }),
    rows: z.array(chatLogRowSchema),
});

export type ChatTurnEvidence = z.infer<typeof chatTurnEvidenceSchema>;

/**
 * One turn's execution record — tool calls, reasoning, narration history,
 * workers, and artifacts — queried per turn instead of riding the chat
 * timeline (specs/chat-timeline.md).
 */
export async function getChatTurnEvidence(
    input: z.infer<typeof chatTurnEvidenceInputSchema>
): Promise<ChatTurnEvidence> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Tavern Runtime is not connected.');
    }

    const client = createTavernClientForConnection(connection);
    const [agents, evidence] = await Promise.all([
        listAgents(),
        client.chat.responseEvidence(input.chatId, input.responseId),
    ]);
    const responsesById = new Map([[evidence.response.id, evidence.response]]);
    const agentNamesById = new Map(agents.map((agent) => [agent.id, agent.name]));
    // The final streamed text segment persists as a narration activity too;
    // matching it against the delivered reply keeps evidence free of a
    // duplicate closing step, same as the timeline projection did.
    const replyRunId = evidence.reply_message
        ? runtimeMetadataString(evidence.reply_message, 'runId')
        : null;
    const finalReplyTextByRunId = new Map(
        evidence.reply_message && replyRunId
            ? [[replyRunId, messageText(evidence.reply_message)]]
            : []
    );

    const rows = [
        ...evidence.activity.flatMap((entry) =>
            activityToChatRows(entry, responsesById, finalReplyTextByRunId, agentNamesById)
        ),
        ...evidence.artifacts.map(artifactToChatRow),
    ];

    return chatTurnEvidenceSchema.parse({
        response: {
            completedAt: evidence.response.completed_at ?? null,
            id: evidence.response.id,
            runId: runtimeMetadataString(evidence.response, 'runId'),
            status: evidence.response.status,
        },
        rows,
    });
}
