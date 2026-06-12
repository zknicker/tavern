import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import {
    getAgentRuntimeToolsetConfig,
    runAgentRuntimeToolsetPostSetup,
    saveAgentRuntimeToolsetEnv,
    selectAgentRuntimeToolsetProvider,
} from '../agent-runtime/toolset-setup.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import {
    toolsetEnvSaveInputSchema,
    toolsetIdInputSchema,
    toolsetPostSetupInputSchema,
    toolsetProviderSelectInputSchema,
} from './contracts.ts';

export async function getToolsetConfig(input: unknown) {
    const parsed = toolsetIdInputSchema.parse(input);
    return requireRuntime(await getAgentRuntimeToolsetConfig(parsed.toolsetId));
}

export async function setToolsetProvider(input: unknown) {
    const parsed = toolsetProviderSelectInputSchema.parse(input);
    const result = requireRuntime(
        await selectAgentRuntimeToolsetProvider(parsed.toolsetId, { provider: parsed.provider })
    );
    emitSkillInvalidationCascade();
    return result;
}

export async function saveToolsetEnv(input: unknown) {
    const parsed = toolsetEnvSaveInputSchema.parse(input);
    const result = requireRuntime(
        await saveAgentRuntimeToolsetEnv(parsed.toolsetId, { env: parsed.env })
    );
    emitSkillInvalidationCascade();
    return result;
}

export async function runToolsetPostSetup(input: unknown) {
    const parsed = toolsetPostSetupInputSchema.parse(input);
    const result = requireRuntime(
        await runAgentRuntimeToolsetPostSetup(parsed.toolsetId, { key: parsed.key })
    );
    if (!result.ok) {
        throw new Error(formatActionFailure(result));
    }
    emitSkillInvalidationCascade();
    return result;
}

function requireRuntime<Result>(result: Result | null): Result {
    if (result === null) {
        throw new Error('Toolset setup is unavailable while the runtime is offline.');
    }
    return result;
}

function formatActionFailure(result: AgentRuntimeSkillHubActionResult) {
    const tail = result.log
        .filter((line) => line.trim().length > 0)
        .slice(-4)
        .join(' ');
    return tail.length > 0 ? `Toolset setup failed: ${tail}` : 'Toolset setup failed.';
}
