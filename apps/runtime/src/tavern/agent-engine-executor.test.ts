import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { describe, expect, it, vi } from 'vitest';
import { createAgentEngineExecutorForTesting } from './agent-engine-executor.ts';
import type { AgentExecutor } from './agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';

describe('agent engine executor', () => {
    it.each([
        { model: 'claude-opus-4-8', provider: 'claude' },
        { model: 'gpt-5.5', provider: 'codex' },
        { model: 'gpt-4.1-mini', provider: 'openai' },
        { model: 'local-model', provider: 'openai-compatible' },
    ] as const)('executes %o through the harness executor', async (model) => {
        const harness = fakeExecutor();
        const executor = createAgentEngineExecutorForTesting(harness);

        const result = await executor.execute(executorInput(model));

        expect(result.contextTokens).toBe(42);
        expect(harness.execute).toHaveBeenCalledTimes(1);
    });

    it('stops active harness turns', async () => {
        const harness = fakeExecutor(true);
        const executor = createAgentEngineExecutorForTesting(harness);

        await expect(executor.stop?.('run_1')).resolves.toBe(true);
        expect(harness.stop).toHaveBeenCalledWith('run_1');
    });
});

function fakeExecutor(stopResult = false): AgentExecutor {
    return {
        execute: vi.fn(async () => ({
            contextTokens: 42,
        })),
        stop: vi.fn(async () => stopResult),
    };
}

function executorInput(model: AgentRuntimeModelName) {
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            archivedAt: null,
            createdAt: now,
            effectiveModel: model,
            generation: 1,
            id: 'ags_agt_primary_1',
            lastTurnAt: null,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        } satisfies AgentRuntimeAgentSession,
        prompt: 'hello',
        runId: 'run_1',
    };
}
