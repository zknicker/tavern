import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { isChannelMuted, muteChannel, unmuteChannel } from './agent-attention.ts';
import { resolveAgentTarget } from './agent-targets.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';

export const agentChannelActionRequestSchema = z
    .object({
        target: z.string().min(1),
    })
    .strict();

export type AgentChannelActionRequest = z.infer<typeof agentChannelActionRequestSchema>;

// Channel membership and attention verbs (I1): join/leave manage the seat;
// mute/unmute manage ordinary delivery without leaving. Personal @mentions
// and DMs still pierce a mute; thread follow records survive it.

export function joinAgentChannel(agentId: string, input: AgentChannelActionRequest) {
    const chat = resolveChannel(agentId, input.target, { requireMembership: false });
    const agent = requireAgent(agentId);
    const participantId = createAgentParticipantId(agentId);
    getDb()
        .prepare(
            `INSERT OR IGNORE INTO chat_participants (chat_id, id, kind, label, metadata_json)
             VALUES ($chatId, $participantId, 'agent', $label, $metadataJson)`
        )
        .run(
            namedParams({
                chatId: chat.id,
                label: agent.name,
                metadataJson: JSON.stringify({ agentId, source: 'tavern' }),
                participantId,
            })
        );
    return { joined: true, target: input.target };
}

export function leaveAgentChannel(agentId: string, input: AgentChannelActionRequest) {
    const chat = resolveChannel(agentId, input.target, { requireMembership: true });
    const participantId = createAgentParticipantId(agentId);
    getDb()
        .prepare('DELETE FROM chat_participants WHERE chat_id = $chatId AND id = $participantId')
        .run(namedParams({ chatId: chat.id, participantId }));
    return { left: true, target: input.target };
}

export function muteAgentChannel(agentId: string, input: AgentChannelActionRequest) {
    const chat = resolveChannel(agentId, input.target, { requireMembership: true });
    muteChannel({ agentId, chatId: chat.id });
    return { muted: true, target: input.target };
}

export function unmuteAgentChannel(agentId: string, input: AgentChannelActionRequest) {
    const chat = resolveChannel(agentId, input.target, { requireMembership: true });
    unmuteChannel({ agentId, chatId: chat.id });
    return { muted: false, target: input.target };
}

export function isAgentChannelMuted(
    agentId: string,
    chatId: string,
    db: Database = getDb()
): boolean {
    return isChannelMuted({ agentId, chatId }, db);
}

function resolveChannel(agentId: string, target: string, options: { requireMembership: boolean }) {
    const resolved = resolveAgentTarget({
        agentId,
        requireMembership: options.requireMembership,
        target,
    });
    if (resolved.chat.kind !== 'channel') {
        throw new AgentApiError(
            'INVALID_TARGET',
            `${resolved.target} is not a channel target. Channel verbs take "#channel-name".`,
            400
        );
    }
    return resolved.chat;
}

function requireAgent(agentId: string) {
    const agent = getStoredAgent(agentId);
    if (!agent) {
        throw new AgentApiError('INFO_FAILED', 'Calling agent was not found.', 404);
    }
    return agent;
}
