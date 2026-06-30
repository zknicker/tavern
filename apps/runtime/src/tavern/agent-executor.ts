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
    execute(input: AgentExecutorInput): Promise<AgentExecutorResult>;
    stop?(runId: string): Promise<boolean> | boolean;
}
