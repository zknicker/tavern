import { executionKindForProvider } from '../models/provider-sources/shared.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { createHarnessAgentExecutor } from './harness-agent-executor.ts';
import { createLanguageModelAgentExecutor } from './language-model-agent-executor.ts';

export function createAgentEngineExecutor(): AgentExecutor {
    return createAgentEngineExecutorWithExecutors({
        harness: createHarnessAgentExecutor(),
        languageModel: createLanguageModelAgentExecutor(),
    });
}

export function createAgentEngineExecutorWithExecutors(executors: {
    harness: AgentExecutor;
    languageModel: AgentExecutor;
}): AgentExecutor {
    return {
        execute(input) {
            return executorForInput(input, executors).execute(input);
        },
        async stop(runId) {
            const results = await Promise.all([
                executors.harness.stop?.(runId) ?? false,
                executors.languageModel.stop?.(runId) ?? false,
            ]);
            return results.some(Boolean);
        },
    };
}

function executorForInput(
    input: AgentExecutorInput,
    executors: { harness: AgentExecutor; languageModel: AgentExecutor }
) {
    const kind = executionKindForProvider(input.agentSession.effectiveModel.provider);
    return kind === 'harness' ? executors.harness : executors.languageModel;
}
