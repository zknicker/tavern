import type { ToolSet } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import * as z from 'zod';
import { getAgentTurn, hasUnsettledAgentTurnsForAgent } from './agent-turn-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { isAgentChatParticipant } from './chat-actions-tools.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat, upsertResponseActivity } from './chat-api/index.ts';

// chat_wait_idle lets an orchestrating agent sequence work: block, bounded,
// until another agent's seat in a chat has no running or queued turn. Waiting
// dispatches nothing and spends no chain budget; it only spends the
// caller's own turn time (specs/addressing.md).
//
// The cap stays under the agent engine's per-tool-call ceiling (~60s on MCP
// transports); longer orchestration waits by calling the tool again.
const defaultTimeoutSeconds = 20;
const maxTimeoutSeconds = 55;
const defaultPollIntervalMs = 250;

let waitSequence = 0;

export function createTavernChatWaitTools(
    input: {
        agentId: string;
        chatId: string;
        runId: string;
    },
    options: { pollIntervalMs?: number } = {}
): ToolSet {
    const participantId = createAgentParticipantId(input.agentId);
    const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs;

    return {
        chat_wait_idle: tool({
            description: `Wait until another agent in a chat is idle (no running or queued turn), so you can sequence work on it. Bounded: waits up to timeoutSeconds (default ${defaultTimeoutSeconds}, max ${maxTimeoutSeconds}) and reports whether the agent went idle; call it again to keep waiting. Waiting spends your own turn time.`,
            inputSchema: z.object({
                agentId: z
                    .string()
                    .min(1)
                    .describe('Agent id from the participant roster (agent://<agentId>).'),
                chatId: z
                    .string()
                    .min(1)
                    .optional()
                    .describe('Chat whose seat to watch. Defaults to the current chat.'),
                timeoutSeconds: z
                    .number()
                    .int()
                    .min(1)
                    .max(maxTimeoutSeconds)
                    .optional()
                    .describe(`Longest wait in seconds (default ${defaultTimeoutSeconds}).`),
            }),
            execute: async ({ agentId, chatId, timeoutSeconds }) => {
                const targetChatId = chatId ?? input.chatId;
                const chat = getChat(targetChatId);
                if (!(chat && isAgentChatParticipant(chat, input.agentId, participantId))) {
                    return { error: 'You are not a participant of that chat.' };
                }
                if (agentId === input.agentId) {
                    return {
                        error: 'That is yourself; your running turn is this one.',
                    };
                }
                if (!isAgentChatParticipant(chat, agentId, createAgentParticipantId(agentId))) {
                    return { error: 'That agent is not a participant of that chat.' };
                }

                const timeoutMs = (timeoutSeconds ?? defaultTimeoutSeconds) * 1000;
                const startedAt = Date.now();
                // A seat is busy exactly when its agent is busy anywhere
                // (specs/sessions.md).
                let idle = !hasUnsettledAgentTurnsForAgent(agentId);
                while (!idle && Date.now() - startedAt < timeoutMs) {
                    await sleep(pollIntervalMs);
                    idle = !hasUnsettledAgentTurnsForAgent(agentId);
                }
                const waitedMs = Date.now() - startedAt;

                recordWaitNotice({
                    caller: input,
                    chatTitle: chat.title ?? targetChatId,
                    idle,
                    targetAgentId: agentId,
                    waitedMs,
                });

                return idle
                    ? { agentId, idle: true, waitedMs }
                    : {
                          agentId,
                          idle: false,
                          note: 'Still working. Call chat_wait_idle again to keep waiting.',
                          timedOut: true,
                          waitedMs,
                      };
            },
        }),
    };
}

// Evidence on the waiting agent's own response, shaped like other runtime
// notices so the chat timeline shows the wait and its outcome.
function recordWaitNotice(input: {
    caller: { agentId: string; chatId: string; runId: string };
    chatTitle: string;
    idle: boolean;
    targetAgentId: string;
    waitedMs: number;
}) {
    const callerTurn = getAgentTurn(input.caller.runId);
    if (!callerTurn) {
        return;
    }
    const targetName = getStoredAgent(input.targetAgentId)?.name ?? input.targetAgentId;
    const seconds = (input.waitedMs / 1000).toFixed(1);
    const text = input.idle
        ? `Waited ${seconds}s for ${targetName} to go idle in "${input.chatTitle}".`
        : `Timed out after ${seconds}s waiting for ${targetName} in "${input.chatTitle}".`;
    const now = new Date().toISOString();
    waitSequence += 1;
    upsertResponseActivity(callerTurn.chatId, callerTurn.responseId, {
        completed_at: now,
        detail: text,
        id: `act_${input.caller.runId}_wait_idle_${waitSequence}`.replace(/[^A-Za-z0-9_-]/g, '_'),
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: input.caller.agentId,
                engine: 'agent-engine',
                notice: {
                    detail: text,
                    id: 'runtime_notice_wait_idle',
                    kind: 'status',
                    sessionId: callerTurn.agentSessionId,
                    text,
                    title: 'Waited for agent',
                },
                runId: input.caller.runId,
                source: 'agent-engine',
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Waited for agent',
    });
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
