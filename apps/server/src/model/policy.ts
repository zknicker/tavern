import {
    type AgentRuntimeModelIdentity,
    type AgentRuntimeModels,
    agentRuntimeModelProviderCapabilities,
    formatAgentRuntimeModelRef,
} from '@tavern/api';
import { TRPCError } from '@trpc/server';

function normalizeModelIdentity(model: null | AgentRuntimeModelIdentity | undefined) {
    return model ?? null;
}

function formatModelIdentity(model: null | AgentRuntimeModelIdentity | undefined) {
    const normalized = normalizeModelIdentity(model);
    return normalized ? formatAgentRuntimeModelRef(normalized) : null;
}

function listConfiguredModelRefs(configuredModels: AgentRuntimeModelIdentity[]) {
    return new Set(configuredModels.map((model) => formatAgentRuntimeModelRef(model)));
}

export function validateRoutingModels(input: AgentRuntimeModels) {
    const configuredModelRefs = listConfiguredModelRefs(input.configuredModels);

    const assertAllowedRef = (input: {
        label: string;
        model: null | AgentRuntimeModelIdentity | undefined;
        surface: 'chat' | 'subagent';
    }) => {
        const normalized = normalizeModelIdentity(input.model);

        if (!normalized) {
            return;
        }

        const capability = agentRuntimeModelProviderCapabilities[normalized.provider];
        const supportsRouting =
            input.surface === 'chat'
                ? capability.supportsChatRouting
                : capability.supportsSubAgentRouting;

        if (!configuredModelRefs.has(formatAgentRuntimeModelRef(normalized))) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `${input.label} must be in the Tavern model catalog.`,
            });
        }

        if (supportsRouting) {
            return;
        }

        throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
                input.surface === 'chat'
                    ? `${input.label} must use a provider that Tavern Runtime supports for chat routing.`
                    : `${input.label} must use a provider that Tavern Runtime supports for subagent routing.`,
        });
    };

    assertAllowedRef({
        label: 'The default chat model',
        model: input.defaults.primaryModel,
        surface: 'chat',
    });
    assertAllowedRef({
        label: 'The default subagent model',
        model: input.subAgentDefaultModel,
        surface: 'subagent',
    });

    for (const modelRef of input.defaults.fallbackModels) {
        assertAllowedRef({
            label: 'A default fallback model',
            model: modelRef,
            surface: 'chat',
        });
    }

    for (const agent of input.agents) {
        assertAllowedRef({
            label: `The subagent model for ${agent.agentId}`,
            model: agent.subAgentModel,
            surface: 'subagent',
        });

        if (!agent.isOverridden) {
            continue;
        }

        assertAllowedRef({
            label: `The primary model for ${agent.agentId}`,
            model: agent.primaryModel,
            surface: 'chat',
        });

        for (const modelRef of agent.fallbackModels) {
            assertAllowedRef({
                label: `A fallback model for ${agent.agentId}`,
                model: modelRef,
                surface: 'chat',
            });
        }
    }
}

export function listInUseModelRefs(agentRuntimeModels: AgentRuntimeModels) {
    return new Set(listModelUsageLabels(agentRuntimeModels).keys());
}

function addModelUsage(
    usagesByModelRef: Map<string, Set<string>>,
    model: null | AgentRuntimeModelIdentity | undefined,
    label: string
) {
    const normalized = formatModelIdentity(model);

    if (!normalized) {
        return;
    }

    const usageLabels = usagesByModelRef.get(normalized) ?? new Set<string>();
    usageLabels.add(label);
    usagesByModelRef.set(normalized, usageLabels);
}

export function listModelUsageLabels(agentRuntimeModels: AgentRuntimeModels) {
    const usagesByModelRef = new Map<string, Set<string>>();

    addModelUsage(
        usagesByModelRef,
        agentRuntimeModels.defaults.primaryModel,
        'Shared default chat model'
    );
    addModelUsage(
        usagesByModelRef,
        agentRuntimeModels.subAgentDefaultModel,
        'Default subagent model'
    );
    for (const modelRef of agentRuntimeModels.defaults.fallbackModels) {
        addModelUsage(usagesByModelRef, modelRef, 'Shared fallback chat model');
    }

    for (const agent of agentRuntimeModels.agents) {
        addModelUsage(
            usagesByModelRef,
            agent.subAgentModel,
            `Agent ${agent.agentId} subagent model`
        );

        if (!agent.isOverridden) {
            continue;
        }

        addModelUsage(usagesByModelRef, agent.primaryModel, `Agent ${agent.agentId} primary model`);

        for (const modelRef of agent.fallbackModels) {
            addModelUsage(usagesByModelRef, modelRef, `Agent ${agent.agentId} fallback model`);
        }
    }

    return new Map(
        [...usagesByModelRef.entries()].map(([modelRef, labels]) => [
            modelRef,
            [...labels].sort((left, right) => left.localeCompare(right)),
        ])
    );
}
