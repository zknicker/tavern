import { buildAgentToolPolicy, defaultAgentToolNames } from '../../agents/tool-policy-defaults.ts';
import { type AgentRecord, listAgents } from '../../storage/agents.ts';
import type { OpenClawConfigFixup } from './types.ts';

export const enforceAgentToolsFixup: OpenClawConfigFixup = {
    apply: async ({ config, context }) => {
        const agents = (await listAgents({ includeInactive: true })).filter(
            (agent) => agent.runtimeId === context.runtimeId
        );
        const fixedConfig = enforceAgentToolPolicies(config, agents);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated OpenClaw default tool policy for Tavern agents.' : null,
        };
    },
    id: 'enforce-agent-tools',
    label: 'Enforce agent tool policy',
};

export function enforceAgentToolPolicies(
    config: Record<string, unknown>,
    agents: Pick<AgentRecord, 'id' | 'name'>[]
) {
    if (agents.length === 0) {
        return config;
    }

    if (hasToolPolicy(readRecord(config.tools))) {
        return config;
    }

    const configAgents = readRecord(config.agents);
    const list = readRecordArray(configAgents.list);
    const configAgentsById = new Map(
        list
            .map((agentConfig) => [readString(agentConfig.id), agentConfig] as const)
            .filter((entry): entry is readonly [string, Record<string, unknown>] =>
                Boolean(entry[0])
            )
    );
    const nextAgentEntries = new Map(configAgentsById);

    for (const agent of agents) {
        const current = configAgentsById.get(agent.id);
        if (hasToolPolicy(readRecord(current?.tools))) {
            continue;
        }

        nextAgentEntries.set(agent.id, writeDefaultAgentTools(current, agent));
    }

    return {
        ...config,
        agents: {
            ...configAgents,
            list: [...nextAgentEntries.values()],
        },
    };
}

function writeDefaultAgentTools(
    current: Record<string, unknown> | undefined,
    agent: Pick<AgentRecord, 'id' | 'name'>
) {
    const tools = readRecord(current?.tools);
    const policy = buildAgentToolPolicy(defaultAgentToolNames);

    return {
        ...(current ?? {
            id: agent.id,
            name: agent.name,
        }),
        tools: {
            ...tools,
            ...policy,
        },
    };
}

function hasToolPolicy(tools: Record<string, unknown>): boolean {
    if ('allow' in tools || 'alsoAllow' in tools || 'deny' in tools || 'profile' in tools) {
        return true;
    }

    const byProviderPolicies = Object.values(readRecord(tools.byProvider)).map(readRecord);
    return byProviderPolicies.some(
        (policy) => Object.keys(policy).length > 0 && hasToolPolicy(policy)
    );
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readRecordArray(value: unknown) {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toStableJson(value: unknown) {
    return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortJson);
    }

    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, sortJson(nested)])
        );
    }

    return value;
}
