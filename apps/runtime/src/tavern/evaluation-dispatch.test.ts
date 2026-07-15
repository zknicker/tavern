import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { setModelProviderEnabled } from '../models/provider-store.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { resetAgentExecutorForTesting, setAgentExecutorForTesting } from './agent-turn-runner.ts';
import { type AgentTurn, listAgentTurnsForSession } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { sendTavernChannelMessage } from './channel-relay.ts';
import {
    createChat,
    createDelivery,
    createMessage,
    getResponseActivity,
    upsertResponse,
} from './chat-api/index.ts';
import {
    collectAgentEvaluationDispatches,
    resetEvaluationChainsForTesting,
} from './evaluation-dispatch.ts';
import { consumeAgentTurnOutcomeNotes } from './turn-outcome-notes.ts';

describe('agent evaluation dispatch', () => {
    const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        resetAgentExecutorForTesting();
        resetEvaluationChainsForTesting();
    });

    afterEach(() => {
        restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
        resetAgentExecutorForTesting();
        resetEvaluationChainsForTesting();
        closeDb();
    });

    it('dispatches evaluation turns to every other seat, mentioned or not', async () => {
        createAgentChannel('agt_a', 'agt_b', 'agt_c');
        setAgentExecutorForTesting(
            createScriptedExecutor({
                agt_a: 'Plain reply, no mentions at all.',
                agt_b: 'NO_REPLY',
                agt_c: 'NO_REPLY',
            })
        );

        await sendTavernChannelMessage('cht_general', messageInput('agt_a'));
        await waitFor(
            () =>
                sessionTurns('agt_b').some((turn) => turn.status === 'completed') &&
                sessionTurns('agt_c').some((turn) => turn.status === 'completed')
        );

        const dispatched = sessionTurns('agt_b')[0];
        expect(dispatched).toMatchObject({
            agentId: 'agt_b',
            metadata: {
                chainHops: 1,
                chainOriginMessageId: 'msg_1',
                dispatchedBy: { agentId: 'agt_a', chatId: 'cht_general' },
                trigger: 'evaluation',
            },
            status: 'completed',
            triggerMessageId: replyMessageId('agt_a', 'msg_1'),
        });

        // Each settled dispatched turn leaves an outcome note for the seat
        // whose message triggered it.
        const notes = consumeAgentTurnOutcomeNotes({
            agentId: 'agt_a',
            chatId: 'cht_general',
            runId: 'run_next_a',
        });
        expect(notes).toHaveLength(2);
        expect(new Set(notes.map((note) => note.status))).toEqual(new Set(['no_reply']));
    });

    it('never dispatches the author back to itself', async () => {
        createAgentChannel('agt_a', 'agt_b');
        setAgentExecutorForTesting(
            createScriptedExecutor({
                agt_a: 'Pinging [myself](agent://agt_a) for fun.',
                agt_b: 'NO_REPLY',
            })
        );

        await sendTavernChannelMessage('cht_general', messageInput('agt_a'));
        await waitFor(() => sessionTurns('agt_b').some((turn) => turn.status === 'completed'));
        await new Promise((resolve) => setTimeout(resolve, 50));

        // A ran the user message; B silently evaluated A's reply; B's silent
        // turn delivered nothing, so the chain ended there.
        expect(sessionTurns('agt_a')).toHaveLength(1);
        expect(sessionTurns('agt_b')).toHaveLength(1);
        const aTriggers = sessionTurns('agt_a').map((turn) => turn.triggerMessageId);
        expect(aTriggers).not.toContain(replyMessageId('agt_a', 'msg_1'));
    });

    it('stops a ping-pong chain at the hop cap and leaves a notice', async () => {
        createAgentChannel('agt_a', 'agt_b');
        setAgentExecutorForTesting(
            createScriptedExecutor({
                agt_a: 'your move.',
                agt_b: 'no, yours.',
            })
        );

        await sendTavernChannelMessage('cht_general', messageInput('agt_a'));
        // Chain: A(hops 0) -> B(1) -> A(2) -> B(3) -> A(4, dispatch suppressed).
        await waitFor(() => {
            const turns = [...sessionTurns('agt_a'), ...sessionTurns('agt_b')];
            return turns.length === 5 && turns.every((turn) => turn.status === 'completed');
        }, 3000);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const turns = [...sessionTurns('agt_a'), ...sessionTurns('agt_b')];
        expect(turns).toHaveLength(5);
        const cappedTurn = turns.find((turn) => turn.metadata.chainHops === 4);
        expect(cappedTurn).toBeDefined();
        const notice = getResponseActivity(
            `act_${cappedTurn?.id}_evaluation_suppressed_agt_b`.replace(/[^A-Za-z0-9_-]/g, '_')
        );
        expect(notice).toMatchObject({
            status: 'completed',
            title: 'Evaluation not dispatched',
        });
    });

    it('dispatches cross-chat posts to every seat of the target chat', async () => {
        createAgentChannel('agt_a', 'agt_b');
        createChat({
            id: 'cht_target',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                {
                    id: 'agt_b',
                    kind: 'agent' as const,
                    label: 'agt_b',
                    metadata: { agentId: 'agt_b' },
                },
            ],
            title: 'Target',
        });
        setAgentExecutorForTesting(
            createScriptedExecutor(
                {
                    agt_a: 'NO_REPLY',
                    agt_b: 'NO_REPLY',
                },
                {
                    agt_a: {
                        chatId: 'cht_target',
                        content: 'Please review this, no mention needed.',
                    },
                }
            )
        );

        await sendTavernChannelMessage('cht_general', messageInput('agt_a'));
        await waitFor(() =>
            listAgentTurnsForSession('ags_cht_target_agt_b_1').some(
                (turn) => turn.status === 'completed'
            )
        );

        const dispatched = listAgentTurnsForSession('ags_cht_target_agt_b_1')[0];
        expect(dispatched).toMatchObject({
            agentId: 'agt_b',
            chatId: 'cht_target',
            metadata: {
                chainHops: 1,
                chainOriginMessageId: 'msg_1',
                trigger: 'evaluation',
            },
            status: 'completed',
        });
        // A's own-chat reply was NO_REPLY, which delivers nothing home, so
        // B's seat in the origin chat dispatched nothing.
        expect(sessionTurns('agt_b')).toHaveLength(0);
    });

    it('suppresses dispatches once the chain budget is spent', () => {
        createAgentChannel('agt_a', 'agt_b');

        let dispatched = 0;
        let suppressedTurn: AgentTurn | null = null;
        for (let index = 1; index <= 17; index += 1) {
            const turn = fabricateCompletedTurn(index);
            const dispatches = collectAgentEvaluationDispatches(turn);
            dispatched += dispatches.length;
            if (dispatches.length === 0) {
                suppressedTurn = turn;
            }
        }

        expect(dispatched).toBe(16);
        expect(suppressedTurn).not.toBeNull();
        const notice = getResponseActivity(
            `act_${suppressedTurn?.id}_evaluation_suppressed_agt_b`.replace(/[^A-Za-z0-9_-]/g, '_')
        );
        expect(notice).toMatchObject({ title: 'Evaluation not dispatched' });
    });
});

function fabricateCompletedTurn(index: number): AgentTurn {
    const now = new Date().toISOString();
    const messageId = `msg_reply_${index}`;
    const responseId = `rsp_fab_${index}`;
    createMessage('cht_general', {
        author_id: 'agt_a',
        content: 'again.',
        id: messageId,
        role: 'assistant',
    });
    upsertResponse('cht_general', {
        id: responseId,
        participant_id: 'agt_a',
        request_message_id: messageId,
        status: 'completed',
    });

    return {
        activityIds: [],
        agentId: 'agt_a',
        agentParticipantId: 'agt_a',
        agentSessionId: 'ags_fab_a',
        attempt: 1,
        chatId: 'cht_general',
        completedAt: now,
        createdAt: now,
        id: `run_fab_${index}`,
        metadata: { chainHops: 1, chainOriginMessageId: 'msg_origin' },
        outputMessageIds: [messageId],
        responseId,
        startedAt: now,
        status: 'completed',
        triggerMessageId: messageId,
        updatedAt: now,
    };
}

function sessionTurns(agentId: string) {
    return listAgentTurnsForSession(`ags_cht_general_${agentId}_1`);
}

function replyMessageId(agentId: string, triggerMessageId: string) {
    const runId = `run_${triggerMessageId.replace(/^msg_/, '')}_${agentId.replace(/^agt_/, '')}`;
    return `msg_${runId}_fake_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function createAgentChannel(...agentIds: string[]) {
    for (const agentId of agentIds) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: agentId,
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }

    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            ...agentIds.map((agentId) => ({
                id: agentId,
                kind: 'agent' as const,
                label: agentId,
                metadata: { agentId },
            })),
        ],
        title: 'General',
    });
}

function createScriptedExecutor(
    replies: Record<string, string>,
    crossPosts: Record<string, { chatId: string; content: string }> = {}
): AgentExecutor {
    return {
        async execute(input: AgentExecutorInput) {
            const now = new Date().toISOString();
            const messageId = replyMessageId(input.agent.id, input.requestMessageId);
            const runtime = {
                agentId: input.agent.id,
                agentSessionId: input.agentSession.id,
                engine: 'agent-engine',
                messageId: input.requestMessageId,
                runId: input.runId,
                source: 'agent-engine',
            };

            const crossPost = crossPosts[input.agent.id];
            if (crossPost) {
                createDelivery(crossPost.chatId, {
                    agent_id: input.agentSession.agentParticipantId,
                    id: `del_${input.runId}_xchat`.replace(/[^A-Za-z0-9_-]/g, '_'),
                    message: {
                        attachments: [],
                        author_id: input.agentSession.agentParticipantId,
                        content: crossPost.content,
                        id: `msg_${input.runId}_xchat`.replace(/[^A-Za-z0-9_-]/g, '_'),
                        metadata: { runtime },
                        role: 'assistant',
                    },
                    metadata: { runtime },
                    turn_id: input.runId,
                });
            }

            const reply = replies[input.agent.id] ?? 'Done.';
            if (reply === 'NO_REPLY') {
                upsertResponse(input.chatId, {
                    completed_at: now,
                    id: input.responseId,
                    metadata: { runtime },
                    participant_id: input.agentSession.agentParticipantId,
                    request_message_id: input.requestMessageId,
                    status: 'completed',
                });
                return { activityIds: [], outputMessageIds: [] };
            }

            const receipt = createDelivery(input.chatId, {
                agent_id: input.agentSession.agentParticipantId,
                id: `del_${input.runId}`.replace(/[^A-Za-z0-9_-]/g, '_'),
                message: {
                    attachments: [],
                    author_id: input.agentSession.agentParticipantId,
                    content: reply,
                    id: messageId,
                    metadata: { runtime },
                    role: 'assistant',
                },
                metadata: { runtime },
                turn_id: input.runId,
            });
            upsertResponse(input.chatId, {
                completed_at: now,
                id: input.responseId,
                metadata: { runtime },
                participant_id: input.agentSession.agentParticipantId,
                request_message_id: input.requestMessageId,
                response_message_id: receipt.message.id,
                status: 'completed',
            });

            return {
                activityIds: [],
                outputMessageIds: [receipt.message.id],
            };
        },
        stop() {
            return true;
        },
    };
}

function messageInput(agentId: string) {
    return {
        agent: { agentId },
        message: {
            content: 'hello there',
            id: 'msg_1',
            nonce: 'nonce_1',
        },
        target: {
            externalId: null,
            target: 'cht_general',
            type: 'tavern' as const,
        },
    };
}

async function waitFor(assertion: () => boolean, timeoutMs = 1500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (assertion()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for assertion.');
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }
    process.env[name] = value;
}
