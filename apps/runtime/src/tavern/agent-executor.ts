import type { AgentRuntimeAgent, AgentRuntimeAgentSession } from '@tavern/api';
export interface AgentExecutorInput {
    agent: AgentRuntimeAgent;
    agentSession: AgentRuntimeAgentSession;
    attachments: Record<string, unknown>[];
    chatId: string;
    content: string;
    metadata?: Record<string, unknown>;
    requestMessageId: string;
    responseId: string;
    runId: string;
}

export interface AgentExecutorResult {
    activityIds: string[];
    outputMessageIds: string[];
}

export interface AgentExecutor {
    /**
     * Deliver a user-visible text into a running turn's engine session.
     * Resolves true only when the engine accepted it; false means the turn
     * is not running or the engine has no mid-turn input, and the message
     * waits for the seat's context cursor (specs/steering.md).
     */
    deliverUserMessage?(runId: string, text: string): Promise<boolean> | boolean;
    execute(input: AgentExecutorInput): Promise<AgentExecutorResult>;
    stop?(runId: string): Promise<boolean> | boolean;
}
