import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { resolveAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createMessage, setThreadFollow } from './chat-api/index.ts';

export const agentThreadUnfollowRequestSchema = z
    .object({
        reason: z.string().max(280).optional(),
        target: z.string().min(1),
    })
    .strict();

export type AgentThreadUnfollowRequest = z.infer<typeof agentThreadUnfollowRequestSchema>;

/**
 * Removes the thread from this agent's followed attention state. Reading and
 * replying stay possible, and posting re-follows. Inbox delivery filtering
 * lands separately; a reason lands as a thread-local system notice so the
 * room sees why the agent stepped away.
 */
export function unfollowAgentThread(
    agentId: string,
    input: AgentThreadUnfollowRequest,
    db: Database = getDb()
) {
    const resolved = resolveAgentTarget({ agentId, target: input.target }, db);
    if (resolved.chat.kind !== 'thread') {
        throw new AgentApiError(
            'INVALID_ARG',
            `${resolved.target} is not a thread target. Use #channel:<shortId> or dm:@peer:<shortId>.`,
            400
        );
    }
    const participantId = createAgentParticipantId(agentId);
    setThreadFollow({ follow: false, participantId, threadChatId: resolved.chat.id }, db);
    const reason = input.reason?.trim();
    if (reason) {
        const handle = getStoredAgent(agentId, db)?.name ?? agentId;
        createMessage(
            resolved.chat.id,
            {
                author_id: 'sys_thread_notice',
                content: `@${handle} unfollowed this thread — ${reason}`,
                id: createMessageId(),
                metadata: { runtime: { source: 'thread-notice' } },
                role: 'system',
            },
            db
        );
    }
    return { target: resolved.target, unfollowed: true };
}
