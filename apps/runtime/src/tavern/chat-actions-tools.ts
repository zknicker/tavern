import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TavernChat } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { findRunningAgentTurnForChatAgent } from './agent-turn-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { createDelivery, getChat, listChatsForAgentParticipant } from './chat-api/index.ts';
import { readMentionedAgentIds } from './mention-projection.ts';
import { recordAgentSteerNotice } from './turn-steering.ts';

// Cross-chat surface: an agent can see the chats it participates in and post
// a message, as itself, into one of them. Posting is gated to chats where the
// agent already holds a seat — Runtime never invents a target. The post
// itself starts no turn for its author, but agent mentions in it dispatch
// turns on the target chat's seats once the posting turn completes, bounded
// by the shared chain guards (specs/agent-mentions.md).
//
// mode picks the delivery when a mentioned agent is already mid-turn in the
// target chat. "queue" (default) lets the mention dispatch a turn that runs
// when the seat frees up; "steer" folds the message into that agent's running
// turn instead — a steer notice lands on the running response and no new turn
// is dispatched for that seat (specs/agent-mentions.md).
const maxChatSendLength = 4000;

let sendSequence = 0;

export function createTavernChatActionTools(input: {
    agentId: string;
    chatId: string;
    runId: string;
}): ToolSet {
    const participantId = createAgentParticipantId(input.agentId);

    return {
        chat_send: tool({
            description:
                'Post a message, as yourself, into another Tavern chat you participate in. Mention an agent of that chat as [Name](agent://<agentId>) to give it a turn there — this is how you consult an agent who is not in the current chat. If a mentioned agent is already mid-turn there, mode "queue" (default) gives it a follow-up turn when its current turn ends; mode "steer" folds your message into its running turn instead of starting a new one. Use chats_list for targets. Post when the user asked or the task requires it; confirm self-initiated posts first.',
            inputSchema: z.object({
                chatId: z.string().min(1).describe('Target chat id from chats_list.'),
                message: z
                    .string()
                    .min(1)
                    .max(maxChatSendLength)
                    .describe('Message text to post in the target chat.'),
                mode: z
                    .enum(['queue', 'steer'])
                    .optional()
                    .describe(
                        'Delivery when a mentioned agent is mid-turn: "queue" (default) dispatches a turn after its current one ends; "steer" merges into the running turn without dispatching a new one.'
                    ),
            }),
            execute: ({ chatId, message, mode }) => {
                if (chatId === input.chatId) {
                    return { error: 'This is the current chat. Reply normally instead.' };
                }
                const chat = getChat(chatId);
                if (!(chat && isAgentChatParticipant(chat, input.agentId, participantId))) {
                    return { error: 'You are not a participant of that chat.' };
                }
                if (isArchivedChat(chat)) {
                    return { error: 'That chat is archived.' };
                }

                const content = message.trim();
                if (!content) {
                    return { error: 'Message text is empty.' };
                }

                sendSequence += 1;
                const messageId = crossChatId('msg', input.runId, sendSequence);
                const steering =
                    mode === 'steer'
                        ? resolveSteerTargets({
                              chat,
                              chatId,
                              content,
                              senderAgentId: input.agentId,
                          })
                        : null;
                const steeredAgentIds = steering?.steered.map((target) => target.agentId) ?? [];
                const runtime = {
                    agentId: input.agentId,
                    crossChat: { fromChatId: input.chatId },
                    engine: 'agent-engine',
                    runId: input.runId,
                    source: 'agent-engine',
                    ...(steeredAgentIds.length > 0 ? { steeredAgentIds } : {}),
                };
                const receipt = createDelivery(chatId, {
                    agent_id: participantId,
                    id: crossChatId('del', input.runId, sendSequence),
                    message: {
                        attachments: [],
                        author_id: participantId,
                        content,
                        id: messageId,
                        metadata: { runtime },
                        role: 'assistant',
                    },
                    metadata: { runtime },
                    turn_id: input.runId,
                });

                for (const target of steering?.steered ?? []) {
                    recordAgentSteerNotice({
                        content,
                        messageId: receipt.message.id,
                        steeredBy: {
                            agentId: input.agentId,
                            name: getStoredAgent(input.agentId)?.name ?? input.agentId,
                        },
                        suffix: `${input.runId}_${sendSequence}`,
                        targetTurn: target.turn,
                    });
                }

                return {
                    chatId,
                    messageId: receipt.message.id,
                    sent: true,
                    ...(steering
                        ? {
                              queuedAgentIds: steering.queued,
                              steeredAgentIds,
                              ...(steeredAgentIds.length === 0
                                  ? {
                                        note: 'No mentioned agent had a running turn there; mentions dispatch turns normally when your current turn completes.',
                                    }
                                  : {}),
                          }
                        : {}),
                };
            },
        }),
        chats_list: tool({
            description:
                'List the Tavern chats you participate in. Use this to find a target chat id for chat_send.',
            inputSchema: z.object({}),
            execute: () => ({
                chats: listChatsForAgentParticipant(participantId)
                    .filter((chat) => !isArchivedChat(chat))
                    .map((chat) => ({
                        current: chat.id === input.chatId,
                        id: chat.id,
                        kind: chat.kind,
                        title: chat.title,
                    })),
            }),
        }),
    };
}

// Mentioned agent participants of the target chat, split by whether their
// seat has a running turn to steer. Idle seats fall back to queue: their
// mentions dispatch normally when the sending turn completes.
function resolveSteerTargets(input: {
    chat: TavernChat;
    chatId: string;
    content: string;
    senderAgentId: string;
}) {
    const chatAgentIds = new Set(
        input.chat.participants
            .filter((participant) => participant.kind === 'agent')
            .map((participant) => {
                const agentId = (participant.metadata as Record<string, unknown>).agentId;
                return typeof agentId === 'string' && agentId.length > 0 ? agentId : participant.id;
            })
    );
    const steered: Array<{
        agentId: string;
        turn: NonNullable<ReturnType<typeof findRunningAgentTurnForChatAgent>>;
    }> = [];
    const queued: string[] = [];
    for (const agentId of readMentionedAgentIds(input.content)) {
        if (agentId === input.senderAgentId || !chatAgentIds.has(agentId)) {
            continue;
        }
        const turn = findRunningAgentTurnForChatAgent({ agentId, chatId: input.chatId });
        if (turn) {
            steered.push({ agentId, turn });
        } else {
            queued.push(agentId);
        }
    }
    return { queued, steered };
}

export function isAgentChatParticipant(chat: TavernChat, agentId: string, participantId: string) {
    return chat.participants.some((participant) => {
        if (participant.kind !== 'agent') {
            return false;
        }
        const metadataAgentId = (participant.metadata as Record<string, unknown>).agentId;
        return (
            participant.id === participantId ||
            (typeof metadataAgentId === 'string' && metadataAgentId === agentId)
        );
    });
}

function isArchivedChat(chat: TavernChat) {
    const tavern = (chat.metadata as Record<string, unknown>).tavern;
    if (!tavern || typeof tavern !== 'object' || Array.isArray(tavern)) {
        return false;
    }
    return (tavern as Record<string, unknown>).archived === true;
}

function crossChatId(prefix: string, runId: string, sequence: number) {
    return `${prefix}_xchat_${runId}_${sequence}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
