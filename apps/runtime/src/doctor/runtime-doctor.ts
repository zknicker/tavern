import type { AgentRuntimeModelCatalogEntry, AgentRuntimeModelName } from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store.ts';
import type { Database } from '../db/sqlite.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import { defaultClaudeModel, defaultCodexModel, defaultOpenAiModel } from '../models/contracts.ts';
import { seedDetectedModelProviders } from '../models/provider-store.ts';
import { readAgentRuntimeProfile } from '../models/runtime-profile-store.ts';
import { saveAgentModelSelectionIntent } from '../models/selection-service.ts';
import { listStoredAgents } from '../tavern/agents-store.ts';

export type RuntimeDoctorModuleId = 'agents' | 'models';
export type RuntimeDoctorRunReason =
    | 'agent_changed'
    | 'manual_check'
    | 'provider_changed'
    | 'runtime_start'
    | 'scheduled_check';

export type RuntimeDoctorScope =
    | { kind: 'agent'; agentId: string }
    | { kind: 'all' }
    | { kind: 'provider'; providerId: string };

export interface RuntimeDoctorResult {
    blockers: Array<{ action: string; id: string; kind: string }>;
    capabilityUpdates: Array<{ capability: string; healthy: boolean }>;
    moduleId: RuntimeDoctorModuleId;
    reason: RuntimeDoctorRunReason;
    repaired: Array<{ id: string; kind: string; summary: string }>;
    scope: RuntimeDoctorScope;
    status: 'blocked' | 'degraded' | 'healthy' | 'repaired';
    warnings: Array<{ id: string; kind: string; message: string }>;
}

export async function runRuntimeDoctor(input: {
    db?: Database;
    modules?: RuntimeDoctorModuleId[];
    reason: RuntimeDoctorRunReason;
    scope?: RuntimeDoctorScope;
}): Promise<RuntimeDoctorResult[]> {
    const modules = input.modules ?? ['models', 'agents'];
    const scope = input.scope ?? { kind: 'all' };
    const results: RuntimeDoctorResult[] = [];

    for (const moduleId of modules) {
        if (moduleId === 'models') {
            results.push(await runModelsDoctor({ db: input.db, reason: input.reason, scope }));
            continue;
        }
        results.push(await runAgentsDoctor({ db: input.db, reason: input.reason, scope }));
    }

    return results;
}

async function runModelsDoctor(input: {
    db?: Database;
    reason: RuntimeDoctorRunReason;
    scope: RuntimeDoctorScope;
}): Promise<RuntimeDoctorResult> {
    const seeded = await seedDetectedModelProviders(input.db);
    const capabilities = await refreshRuntimeCapabilities({
        ids: ['modelExecution'],
        publishUpdated: true,
    });
    const modelExecution = capabilities.find((capability) => capability.id === 'modelExecution');
    return {
        blockers: modelExecution?.healthy
            ? []
            : [
                  {
                      action: 'Add or repair a model provider.',
                      id: 'modelExecution',
                      kind: 'capability',
                  },
              ],
        capabilityUpdates: modelExecution
            ? [{ capability: modelExecution.id, healthy: modelExecution.healthy }]
            : [],
        moduleId: 'models',
        reason: input.reason,
        repaired: seeded.map((providerId) => ({
            id: providerId,
            kind: 'provider',
            summary: 'Enabled detected provider access.',
        })),
        scope: input.scope,
        status: modelExecution?.healthy ? (seeded.length > 0 ? 'repaired' : 'healthy') : 'blocked',
        warnings: [],
    };
}

async function runAgentsDoctor(input: {
    db?: Database;
    reason: RuntimeDoctorRunReason;
    scope: RuntimeDoctorScope;
}): Promise<RuntimeDoctorResult> {
    const inventory = await listAgentModels();
    const fallback = highestRankedExecutableModel(inventory.models);
    const agents = listScopedAgents(input.scope, input.db);
    const repaired: RuntimeDoctorResult['repaired'] = [];
    const blockers: RuntimeDoctorResult['blockers'] = [];

    for (const agent of agents) {
        const profile = readAgentRuntimeProfile(agent.id, input.db);
        if (profile && isExecutableModel(profile.defaultModel, inventory.models)) {
            continue;
        }
        if (!fallback) {
            blockers.push({
                action: 'Add or repair a model provider.',
                id: agent.id,
                kind: 'agent',
            });
            continue;
        }
        saveAgentModelSelectionIntent({
            agentId: agent.id,
            db: input.db,
            modelName: fallback,
        });
        repaired.push({
            id: agent.id,
            kind: 'agent',
            summary: `Set default model to ${fallback.provider}/${fallback.model}.`,
        });
    }

    return {
        blockers,
        capabilityUpdates: [],
        moduleId: 'agents',
        reason: input.reason,
        repaired,
        scope: input.scope,
        status: blockers.length > 0 ? 'blocked' : repaired.length > 0 ? 'repaired' : 'healthy',
        warnings: [],
    };
}

function listScopedAgents(scope: RuntimeDoctorScope, db?: Database) {
    const agents = listStoredAgents(db).agents;
    return scope.kind === 'agent' ? agents.filter((agent) => agent.id === scope.agentId) : agents;
}

function isExecutableModel(
    model: AgentRuntimeModelName,
    models: AgentRuntimeModelCatalogEntry[]
): boolean {
    return models.some(
        (candidate) =>
            candidate.provider === model.provider &&
            candidate.route.model === model.model &&
            candidate.availability === 'available'
    );
}

function highestRankedExecutableModel(
    models: AgentRuntimeModelCatalogEntry[]
): AgentRuntimeModelName | null {
    const rank = new Map([
        ['codex', 0],
        ['claude', 1],
        ['openai', 2],
    ]);
    const [best] = models
        .filter((model) => model.availability === 'available' && model.provider)
        .sort((left, right) => {
            const leftRank = rank.get(left.provider ?? '') ?? 100;
            const rightRank = rank.get(right.provider ?? '') ?? 100;
            return (
                leftRank - rightRank ||
                modelPreferenceRank(left) - modelPreferenceRank(right) ||
                left.route.model.localeCompare(right.route.model) ||
                left.id.localeCompare(right.id)
            );
        });

    return best?.provider ? { model: best.route.model, provider: best.provider } : null;
}

function modelPreferenceRank(model: AgentRuntimeModelCatalogEntry) {
    if (model.provider === 'codex' && model.route.model === defaultCodexModel) {
        return 0;
    }
    if (model.provider === 'claude' && model.route.model === defaultClaudeModel) {
        return 0;
    }
    if (model.provider === 'openai' && model.route.model === defaultOpenAiModel) {
        return 0;
    }
    return 1;
}
