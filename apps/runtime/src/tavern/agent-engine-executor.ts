import type { AgentExecutor } from './agent-executor.ts';
import { createHarnessAgentExecutor } from './harness-agent-executor.ts';

export function createAgentEngineExecutor(): AgentExecutor {
    return createHarnessAgentExecutor();
}

export function createAgentEngineExecutorForTesting(executor: AgentExecutor): AgentExecutor {
    return executor;
}
