import * as z from 'zod';
import { AgentApiError } from './agent-api-errors.ts';
import { toAgentMessage } from './agent-messages.ts';
import {
    AmbiguousMessageIdError,
    ReactionError,
    resolveMessageId,
    setMessageReaction,
} from './chat-api/index.ts';

export const agentReactionRequestSchema = z
    .object({
        emoji: z.string().trim().min(1),
        messageId: z.string().trim().min(1),
        remove: z.boolean().optional(),
    })
    .strict();

export function reactToAgentMessage(
    agentId: string,
    input: z.infer<typeof agentReactionRequestSchema>
) {
    let message: ReturnType<typeof resolveMessageId>;
    try {
        message = resolveMessageId(input.messageId);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            throw new AgentApiError('AMBIGUOUS_ID', error.message, 409);
        }
        throw error;
    }
    if (!message) {
        throw new AgentApiError(
            'TARGET_NOT_FOUND',
            `Message ${input.messageId} was not found.`,
            404
        );
    }
    let updated: ReturnType<typeof setMessageReaction>;
    try {
        updated = setMessageReaction({
            actorId: agentId,
            emoji: input.emoji,
            messageId: message.id,
            remove: input.remove,
        });
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
