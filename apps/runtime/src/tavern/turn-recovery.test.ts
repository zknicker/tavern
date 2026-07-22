import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureCurrentAgentSession } from './agent-session-store';
import { claimNextAgentTurnForAgent, createAgentTurn, getAgentTurn } from './agent-turn-store';
import { ensurePrimaryManagedAgent } from './managed-agent';
import { recoverInterruptedAgentTurns } from './turn-recovery';

describe('turn recovery', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('finalizes orphaned non-terminal agent turns', () => {
        const agent = ensurePrimaryManagedAgent();
        const session = ensureCurrentAgentSession({ agentId: agent.id });
        createAgentTurn({
            agentId: agent.id,
            agentSessionId: session.id,
            id: 'run_stuck',
            kind: 'start',
        });
        claimNextAgentTurnForAgent({ agentId: agent.id });

        const recovered = recoverInterruptedAgentTurns();

        expect(recovered).toBe(1);
        expect(getAgentTurn('run_stuck')).toMatchObject({
            completedAt: expect.any(String),
            metadata: { error: 'Interrupted by an agent runtime restart.' },
            status: 'failed',
        });
    });

    test('is a no-op when every turn is terminal', () => {
        const agent = ensurePrimaryManagedAgent();
        const session = ensureCurrentAgentSession({ agentId: agent.id });
        createAgentTurn({
            agentId: agent.id,
            agentSessionId: session.id,
            id: 'run_queued',
            kind: 'start',
        });

        expect(recoverInterruptedAgentTurns()).toBe(0);
        expect(getAgentTurn('run_queued')).toMatchObject({ status: 'queued' });
    });
});
