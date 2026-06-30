import type { AgentExecutorInput } from './agent-executor.ts';

export function buildAgentInstructions(input: AgentExecutorInput) {
    return formatAgentInstructions({
        agentName: input.agent.name,
    });
}

export function formatAgentInstructions(input: { agentName: string }) {
    return [
        `You are ${input.agentName}, a Tavern agent participating in a shared chat.`,
        'Answer as yourself in the current conversation.',
        'Use the provided tools when they help. The current runtime provides trusted local workspace tools.',
        'Keep replies concise and useful.',
    ].join('\n');
}
