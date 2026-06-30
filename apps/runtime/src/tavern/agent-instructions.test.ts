import type { AgentRuntimeAgent } from '@tavern/api';
import { describe, expect, it } from 'vitest';
import type { AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructions } from './agent-instructions.ts';

const now = '2026-06-29T12:00:00.000Z';

describe('agent instructions', () => {
    it('keeps assigned skills out of the AI SDK instruction text', () => {
        const instructions = buildAgentInstructions(
            executorInput({
                enabledSkillIds: ['research'],
            })
        );

        expect(instructions).toContain('You are Tavern');
        expect(instructions).not.toContain('research');
        expect(instructions).not.toContain('SKILL.md');
    });
});

function executorInput(agentOverrides: Partial<AgentRuntimeAgent> = {}): AgentExecutorInput {
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
            ...agentOverrides,
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            archivedAt: null,
            chatId: 'cht_general',
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_cht_general_agt_primary_1',
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        },
        attachments: [],
        chatId: 'cht_general',
        content: 'hello',
        requestMessageId: 'msg_1',
        responseId: 'rsp_run_1',
        runId: 'run_1',
    };
}
