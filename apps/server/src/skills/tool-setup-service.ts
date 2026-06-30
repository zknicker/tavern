import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import {
    getAgentRuntimeToolConfig,
    runAgentRuntimeToolPostSetup,
    saveAgentRuntimeToolEnv,
    selectAgentRuntimeToolProvider,
} from '../agent-runtime/tool-setup.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import {
    toolEnvSaveInputSchema,
    toolIdInputSchema,
    toolPostSetupInputSchema,
    toolProviderSelectInputSchema,
} from './contracts.ts';

export async function getToolConfig(input: unknown) {
    const parsed = toolIdInputSchema.parse(input);
    return requireRuntime(await getAgentRuntimeToolConfig(parsed.toolId));
}

export async function setToolProvider(input: unknown) {
    const parsed = toolProviderSelectInputSchema.parse(input);
    const result = requireRuntime(
        await selectAgentRuntimeToolProvider(parsed.toolId, { provider: parsed.provider })
    );
    emitSkillInvalidationCascade();
    return result;
}

export async function saveToolEnv(input: unknown) {
    const parsed = toolEnvSaveInputSchema.parse(input);
    const result = requireRuntime(
        await saveAgentRuntimeToolEnv(parsed.toolId, { env: parsed.env })
    );
    emitSkillInvalidationCascade();
    return result;
}

export async function runToolPostSetup(input: unknown) {
    const parsed = toolPostSetupInputSchema.parse(input);
    const result = requireRuntime(
        await runAgentRuntimeToolPostSetup(parsed.toolId, { key: parsed.key })
    );
    if (!result.ok) {
        throw new Error(formatActionFailure(result));
    }
    emitSkillInvalidationCascade();
    return result;
}

function requireRuntime<Result>(result: Result | null): Result {
    if (result === null) {
        throw new Error('Tool setup is unavailable while the runtime is offline.');
    }
    return result;
}

function formatActionFailure(result: AgentRuntimeSkillHubActionResult) {
    const tail = result.log
        .filter((line) => line.trim().length > 0)
        .slice(-4)
        .join(' ');
    return tail.length > 0 ? `Tool setup failed: ${tail}` : 'Tool setup failed.';
}
