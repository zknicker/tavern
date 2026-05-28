import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { getCortexSettings } from '../cortex/settings';
import { getDb } from '../db/connection';
import { listRuntimeJobRuns } from '../jobs/history';
import { getManagedOpenClawState } from '../openclaw/state';
import { getStoredOpenClawModels } from '../tavern/openclaw-snapshots-store';

export interface RuntimeCapabilityCheckResult {
    metadata?: Record<string, unknown>;
    reason?: string | null;
    state: AgentRuntimeCapabilityHealthState;
    technicalMessage?: string | null;
}

export interface RuntimeCapabilityDefinition {
    check(): Promise<RuntimeCapabilityCheckResult> | RuntimeCapabilityCheckResult;
    displayName: string;
    id: AgentRuntimeCapabilityHealthId;
    refresh: {
        intervalMs: number;
        runOnStart: boolean;
    };
}

const minuteMs = 60 * 1000;

export const runtimeCapabilityDefinitions: RuntimeCapabilityDefinition[] = [
    healthyCapability('agentFiles', 'agent files'),
    healthyCapability('agentTurns', 'agent turns'),
    healthyCapability('agents', 'agents'),
    healthyCapability('chats', 'chats'),
    healthyCapability('chatTargets', 'chat targets'),
    healthyCapability('computerUse', 'computer use', 10 * minuteMs),
    healthyCapability('cron', 'cron'),
    healthyCapability('cronRuns', 'cron runs'),
    healthyCapability('events', 'events'),
    healthyCapability('knowledgebase', 'knowledgebase'),
    healthyCapability('logs', 'logs'),
    healthyCapability('mentions', 'mentions'),
    healthyCapability('messages', 'messages'),
    healthyCapability('sessionEvents', 'session events'),
    healthyCapability('sessions', 'sessions'),
    healthyCapability('skills', 'skills'),
    healthyCapability('skillMaterialization', 'skill materialization'),
    healthyCapability('status', 'runtime'),
    healthyCapability('tasks', 'tasks'),
    {
        check() {
            const managedOpenClaw = getManagedOpenClawState();
            return managedOpenClaw.tavernPluginPath
                ? { state: 'healthy' }
                : {
                      reason: 'Managed OpenClaw has not installed the Tavern plugin.',
                      state: 'unavailable',
                  };
        },
        displayName: 'tavernPlugin',
        id: 'tavernPlugin',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return getManagedOpenClawState().gatewayReady === false
                ? {
                      reason: 'Managed OpenClaw Gateway is not ready.',
                      state: 'unavailable',
                  }
                : { state: 'healthy' };
        },
        displayName: 'gateway',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return getManagedOpenClawState().gatewayReady === false
                ? {
                      reason: 'Managed OpenClaw Gateway is not ready.',
                      state: 'unavailable',
                  }
                : { state: 'healthy' };
        },
        displayName: 'memory',
        id: 'memory',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkEmbeddingModelCapability();
        },
        displayName: 'embedding model',
        id: 'embeddingModel',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            const models = getStoredOpenClawModels();
            return models.agents.length > 0
                ? { state: 'healthy' }
                : {
                      reason: 'Runtime has not synced model inventory yet.',
                      state: 'unknown',
                  };
        },
        displayName: 'models',
        id: 'models',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

function healthyCapability(
    id: AgentRuntimeCapabilityHealthId,
    displayName: string,
    intervalMs = 5 * minuteMs
): RuntimeCapabilityDefinition {
    return {
        check() {
            return { state: 'healthy' };
        },
        displayName,
        id,
        refresh: {
            intervalMs,
            runOnStart: true,
        },
    };
}

export function getRuntimeCapabilityDefinition(id: AgentRuntimeCapabilityHealthId) {
    const definition = runtimeCapabilityDefinitions.find((capability) => capability.id === id);
    if (!definition) {
        throw new Error(`Unknown Runtime capability: ${id}`);
    }
    return definition;
}

export function getExpectedRuntimeCapability(
    definition: RuntimeCapabilityDefinition
): AgentRuntimeCapabilityHealth {
    return {
        checkedAt: null,
        displayName: definition.displayName,
        healthy: false,
        id: definition.id,
        lastHealthyAt: null,
        metadata: {},
        nextCheckAt: null,
        reason: 'Capability has not been checked yet.',
        state: 'unknown',
        technicalMessage: null,
        updatedAt: null,
    };
}

async function checkEmbeddingModelCapability(): Promise<RuntimeCapabilityCheckResult> {
    const settings = getCortexSettings(getDb()).embedding;
    if (!(settings.apiKeyConfigured && settings.apiKey)) {
        return {
            reason: 'OpenAI API key is not configured for Cortex embeddings.',
            state: 'unavailable',
        };
    }

    const latestError = getLatestCortexEmbeddingError();
    if (latestError) {
        return {
            reason: describeEmbeddingFailure(latestError),
            state: 'degraded',
            technicalMessage: latestError,
        };
    }

    const modelCheck = await checkOpenAiModelVisibility({
        apiKey: settings.apiKey,
        model: settings.model,
    });
    if (!modelCheck.ok) {
        return modelCheck;
    }

    return {
        metadata: {
            model: settings.model,
            provider: settings.provider,
            quotaVerified: false,
        },
        state: 'healthy',
    };
}

function getLatestCortexEmbeddingError() {
    const latestRun = listRuntimeJobRuns('cortex-generate-embeddings', 1)[0] ?? null;
    return latestRun?.state === 'failed' ? latestRun.error?.trim() || null : null;
}

function describeEmbeddingFailure(error: string) {
    if (error.includes('insufficient_quota')) {
        return 'OpenAI embeddings are failing because the API project has insufficient quota.';
    }
    if (error.includes('429')) {
        return 'OpenAI embeddings are failing because OpenAI returned 429. Check API quota or rate limits.';
    }
    return `OpenAI embeddings are failing: ${error}`;
}

async function checkOpenAiModelVisibility(input: { apiKey: string; model: string }) {
    const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
            Authorization: `Bearer ${input.apiKey}`,
        },
        signal: AbortSignal.timeout(3000),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = extractOpenAiErrorMessage(payload);
        const authFailure = response.status === 401 || response.status === 403;

        return {
            ok: false as const,
            reason: authFailure
                ? 'OpenAI API key could not be authenticated.'
                : 'OpenAI embedding model visibility check failed.',
            state: authFailure ? ('unauthorized' as const) : ('degraded' as const),
            technicalMessage: message
                ? `OpenAI model list check failed (${response.status}): ${message}`
                : `OpenAI model list check failed (${response.status}).`,
        };
    }

    if (!parseOpenAiModelIds(payload).has(input.model)) {
        return {
            ok: false as const,
            reason: `${input.model} is not visible to this OpenAI API key.`,
            state: 'degraded' as const,
            technicalMessage: null,
        };
    }

    return { ok: true as const };
}

function extractOpenAiErrorMessage(payload: unknown) {
    if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
    ) {
        return payload.error.message;
    }

    return null;
}

function parseOpenAiModelIds(payload: unknown) {
    if (
        !payload ||
        typeof payload !== 'object' ||
        !('data' in payload) ||
        !Array.isArray(payload.data)
    ) {
        return new Set<string>();
    }

    return new Set(
        payload.data.flatMap((model) =>
            model && typeof model === 'object' && 'id' in model && typeof model.id === 'string'
                ? [model.id]
                : []
        )
    );
}
