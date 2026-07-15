import type { AgentRuntimeAgentSession } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { saveAgentModelSelectionIntent } from '../models/selection-service';
import type { AgentExecutorInput } from './agent-executor';
import { ensureCurrentAgentSession, updateAgentSessionRuntimeState } from './agent-session-store';
import {
    enqueueAgentTurn,
    setAgentExecutorForTesting,
    waitForAgentTurnSettlement,
} from './agent-turn-runner';
import { claimNextAgentTurnForAgent, createAgentTurn } from './agent-turn-store';
import { getStoredAgent, upsertStoredAgent } from './agents-store';
import { createChat, createMessage, upsertResponse } from './chat-api';

describe('Tavern Runtime agent turn runner', () => {
    let restoreExecutor: (() => void) | null = null;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        restoreExecutor?.();
        restoreExecutor = null;
        closeDb();
    });

    it('executes a queued turn with the session state its predecessor persisted', async () => {
        // A mention enqueues the seat's next turn while the current one is
        // still running, so the queued input carries a session snapshot from
        // before that turn persisted its engine session. The claimed turn
        // must re-read the session row — otherwise the trailing turn starts
        // a fresh engine session and silently drops the seat's context chain.
        const staleSession = seedSeat();
        const executedSessions: AgentRuntimeAgentSession[] = [];
        let releaseFirstTurn = () => {};
        const firstTurnGate = new Promise<void>((resolve) => {
            releaseFirstTurn = resolve;
        });

        restoreExecutor = setAgentExecutorForTesting({
            execute: async (input) => {
                executedSessions.push(input.agentSession);
                if (input.runId === 'run_1') {
                    await firstTurnGate;
                    updateAgentSessionRuntimeState({
                        id: input.agentSession.id,
                        resumeState: { harness: 'state-from-turn-1' },
                        runtimeSessionId: 'ses_engine_1',
                    });
                }
                return { activityIds: [], outputMessageIds: [] };
            },
        });

        enqueueAgentTurn(turnInput({ index: 1, session: staleSession }));
        // Mimics mention dispatch: enqueued mid-turn with the same stale snapshot.
        enqueueAgentTurn(turnInput({ index: 2, session: staleSession }));
        releaseFirstTurn();

        await waitForAgentTurnSettlement('run_2');

        expect(executedSessions).toHaveLength(2);
        expect(executedSessions[0]?.runtimeSessionId).toBeNull();
        expect(executedSessions[1]).toMatchObject({
            id: staleSession.id,
            resumeState: { harness: 'state-from-turn-1' },
            runtimeSessionId: 'ses_engine_1',
        });
    });

    it('claims the oldest queued turn across chats, one at a time (auto-drain order)', () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_drain',
                isAdmin: false,
                name: 'Drain',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_drain',
            },
        });
        const session = ensureCurrentAgentSession({ agentId: 'agt_drain' });
        for (const chatId of ['cht_drain_a', 'cht_drain_b']) {
            createChat({
                id: chatId,
                kind: 'channel',
                participants: [
                    { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                    {
                        id: 'agt_drain',
                        kind: 'agent',
                        label: 'Drain',
                        metadata: { agentId: 'agt_drain' },
                    },
                ],
                title: chatId,
            });
        }
        const seed = (runId: string, chatId: string) => {
            createMessage(chatId, {
                author_id: 'usr_tavern',
                content: `work ${runId}`,
                id: `msg_${runId}`,
                role: 'user',
            });
            upsertResponse(chatId, {
                id: `rsp_${runId}`,
                participant_id: 'agt_drain',
                request_message_id: `msg_${runId}`,
                status: 'queued',
            });
            createAgentTurn({
                agentId: 'agt_drain',
                agentParticipantId: 'agt_drain',
                agentSessionId: session.id,
                chatId,
                id: runId,
                responseId: `rsp_${runId}`,
                triggerMessageId: `msg_${runId}`,
            });
        };
        // Enqueued in b, a, b order: the claim must walk strictly oldest
        // first across chats — no chat priority, no preemption
        // (specs/sessions.md attention).
        seed('run_1', 'cht_drain_b');
        seed('run_2', 'cht_drain_a');
        seed('run_3', 'cht_drain_b');

        const first = claimNextAgentTurnForAgent({ agentId: 'agt_drain' });
        expect(first?.id).toBe('run_1');
        // One turn at a time: nothing else claims while run_1 runs.
        expect(claimNextAgentTurnForAgent({ agentId: 'agt_drain' })).toBeNull();
    });
});

function seedSeat() {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
        },
        syncedAt: '2026-07-14T12:00:00.000Z',
    });
    saveAgentModelSelectionIntent({
        agentId: 'agt_primary',
        modelName: { model: 'gpt-4.1-mini', provider: 'openai' },
    });
    createChat({
        id: 'cht_1',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
    });

    return ensureCurrentAgentSession({ agentId: 'agt_primary', now: '2026-07-14T12:00:00.000Z' });
}

function turnInput(input: {
    index: number;
    session: AgentRuntimeAgentSession;
}): AgentExecutorInput {
    const agent = getStoredAgent('agt_primary');
    if (!agent) {
        throw new Error('Test agent is missing.');
    }

    createMessage('cht_1', {
        author_id: 'usr_tavern',
        content: `trigger ${input.index}`,
        id: `msg_${input.index}`,
        role: 'user',
    });
    upsertResponse('cht_1', {
        id: `rsp_${input.index}`,
        participant_id: 'agt_primary',
        request_message_id: `msg_${input.index}`,
        status: 'running',
    });

    return {
        agent,
        agentParticipantId: 'agt_primary',
        agentSession: input.session,
        attachments: [],
        chatId: 'cht_1',
        content: `trigger ${input.index}`,
        requestMessageId: `msg_${input.index}`,
        responseId: `rsp_${input.index}`,
        runId: `run_${input.index}`,
    };
}
