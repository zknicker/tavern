import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { getAgentMessage } from './agent-history.ts';
import { toAgentMessage } from './agent-messages.ts';
import { ReactionError, setMessageReaction } from './chat-api/index.ts';

export const agentReactionRequestSchema = z
    .object({
        emoji: z.string().trim().min(1),
        messageId: z.string().trim().min(1),
        remove: z.boolean().optional(),
    })
    .strict();

export function reactToAgentMessage(
    agentId: string,
    input: z.infer<typeof agentReactionRequestSchema>,
    db: Database = getDb()
) {
    const message = getAgentMessage(agentId, input.messageId, db).message;
    let updated: ReturnType<typeof setMessageReaction>;
    try {
        updated = setMessageReaction(
            {
                actorId: agentId,
                emoji: input.emoji,
                messageId: message.id,
                remove: input.remove,
            },
            db
        );
    } catch (error) {
        if (error instanceof ReactionError) {
            throw new AgentApiError(
                'TARGET_NOT_FOUND',
                `Message ${input.messageId} was not found.`,
                404
            );
        }
        throw error;
    }
    return { message: toAgentMessage(updated) };
}
