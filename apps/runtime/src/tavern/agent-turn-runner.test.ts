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
                        promptContextSequence: 41,
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
            promptContextSequence: 41,
            resumeState: { harness: 'state-from-turn-1' },
            runtimeSessionId: 'ses_engine_1',
        });
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

    return ensureCurrentAgentSession({
        agentParticipantId: 'agt_primary',
        chatId: 'cht_1',
        now: '2026-07-14T12:00:00.000Z',
    });
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
        participant_id: input.session.agentParticipantId,
        request_message_id: `msg_${input.index}`,
        status: 'running',
    });

    return {
        agent,
        agentSession: input.session,
        attachments: [],
        chatId: 'cht_1',
        content: `trigger ${input.index}`,
        requestMessageId: `msg_${input.index}`,
        responseId: `rsp_${input.index}`,
        runId: `run_${input.index}`,
    };
}
