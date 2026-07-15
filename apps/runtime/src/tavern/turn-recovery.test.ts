import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureCurrentAgentSession } from './agent-session-store';
import { createAgentTurn, getAgentTurn } from './agent-turn-store';
import { createChat, createMessage, getResponse, upsertResponse } from './chat-api';
import { ensurePrimaryManagedAgent } from './managed-agent';
import { recoverInterruptedChatResponses } from './turn-recovery';

describe('turn recovery', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('finalizes responses orphaned in a non-terminal state', () => {
        createChat({ id: 'cht_1', title: 'Recovery' });
        upsertResponse('cht_1', {
            id: 'rsp_stuck',
            metadata: { runtime: { runId: 'run_1', source: 'agent-engine' } },
            participant_id: 'agt_demo',
            status: 'running',
        });
        upsertResponse('cht_1', {
            id: 'rsp_done',
            participant_id: 'agt_demo',
            status: 'completed',
        });

        const recovered = recoverInterruptedChatResponses();

        expect(recovered).toBe(1);
        const stuck = getResponse('rsp_stuck');
        expect(stuck).toMatchObject({
            status: 'failed',
            summary: 'Interrupted by an agent runtime restart.',
        });
        expect(stuck?.completed_at).toBeTruthy();
        expect(stuck?.metadata).toMatchObject({
            error: 'Interrupted by an agent runtime restart.',
            runtime: {
                errorCode: 'control_plane_restarted',
                runId: 'run_1',
                source: 'agent-engine',
            },
        });
        expect(getResponse('rsp_done')?.status).toBe('completed');
    });

    test('finalizes orphaned non-terminal agent turns', () => {
        const agent = ensurePrimaryManagedAgent();
        createChat({ id: 'cht_1', title: 'Recovery' });
        createMessage('cht_1', {
            author_id: 'usr_demo',
            content: 'hello',
            id: 'msg_demo',
            role: 'user',
        });
        createMessage('cht_1', {
            author_id: agent.id,
            content: 'hello',
            id: 'msg_agent_seed',
            role: 'assistant',
        });
        upsertResponse('cht_1', {
            id: 'rsp_stuck',
            participant_id: agent.id,
            status: 'failed',
            summary: 'Interrupted by an agent runtime restart.',
        });
        const session = ensureCurrentAgentSession({ agentId: agent.id });
        createAgentTurn({
            agentId: agent.id,
            agentParticipantId: agent.id,
            agentSessionId: session.id,
            chatId: 'cht_1',
            id: 'run_stuck',
            responseId: 'rsp_stuck',
            triggerMessageId: 'msg_demo',
        });

        const recovered = recoverInterruptedChatResponses();

        expect(recovered).toBe(1);
        expect(getAgentTurn('run_stuck')).toMatchObject({
            completedAt: expect.any(String),
            metadata: { error: 'Interrupted by an agent runtime restart.' },
            status: 'failed',
        });
    });

    test('is a no-op when every response is terminal', () => {
        createChat({ id: 'cht_1', title: 'Recovery' });
        upsertResponse('cht_1', {
            id: 'rsp_done',
            participant_id: 'agt_demo',
            status: 'completed',
        });

        expect(recoverInterruptedChatResponses(getDb())).toBe(0);
    });
});
