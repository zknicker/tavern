import * as React from 'react';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import type { RouteTab } from '../dashboard/use-route-tab.ts';
import { useRuntimeConnection } from './use-runtime-connection.ts';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapabilityStatus = RuntimeConnection['runtimeCapabilities'][number];

export type RuntimeCapabilityId = RuntimeCapabilityStatus['capability'];
export type CapabilityRequirement = RuntimeCapabilityId | readonly RuntimeCapabilityId[];

export interface CapabilityView {
    healthy: boolean;
    missingCapabilities: RuntimeCapabilityId[];
    reason: string | null;
    state: RuntimeCapabilityStatus['state'];
    status: RuntimeCapabilityStatus | null;
}

const runtimeDisconnectedReason = 'Tavern Runtime is disconnected.';
const capabilityLabels = {
    agentFiles: 'Agent Files',
    agentTurns: 'Agent Turns',
    agents: 'Agents',
    chatTargets: 'Chat Targets',
    chats: 'Chats',
    codexOAuth: 'Codex OAuth',
    computerUse: 'Computer Use',
    cortexDatabase: 'Cortex Database',
    cortexWiki: 'Cortex Wiki',
    cron: 'Cron',
    cronRuns: 'Cron Runs',
    embeddingModel: 'Embedding Model',
    events: 'Events',
    gateway: 'Gateway',
    knowledgebase: 'Knowledgebase',
    logs: 'Logs',
    memory: 'Memory',
    mentions: 'Mentions',
    messages: 'Messages',
    models: 'Models',
    sessionEvents: 'Session Events',
    sessions: 'Sessions',
    skillMaterialization: 'Skill Materialization',
    skills: 'Skills',
    status: 'Status',
    tasks: 'Tasks',
    tavernPlugin: 'Tavern Plugin',
} satisfies Record<RuntimeCapabilityId, string>;

export const settingsCapabilityRequirements = {
    'agent-runtime': [],
    agent: ['status', 'agents'],
    appearance: [],
    jobs: ['status', 'tasks', 'cron', 'cronRuns'],
    memories: ['status', 'memory', 'cortexDatabase', 'cortexWiki'],
    models: ['status', 'models'],
    participants: [],
    sessions: ['status', 'sessions', 'sessionEvents'],
    skills: ['status', 'skills', 'skillMaterialization'],
    stats: ['status'],
    updates: [],
} as const satisfies Record<string, readonly RuntimeCapabilityId[]>;

export const routeTabCapabilityRequirements = {
    cortex: ['status', 'cortexDatabase', 'cortexWiki', 'knowledgebase', 'memory'],
    cron: ['status', 'tasks', 'cron', 'cronRuns'],
    overview: [],
} as const satisfies Record<RouteTab, readonly RuntimeCapabilityId[]>;

export const newChatCapabilityRequirements = ['status', 'chats', 'messages', 'agents'] as const;

export function getCapability(
    connection: AgentRuntimeConnectionOutput,
    requirement: CapabilityRequirement
): CapabilityView {
    const capabilities = toCapabilityList(requirement);

    if (capabilities.length === 0) {
        return {
            healthy: true,
            missingCapabilities: [],
            reason: null,
            state: 'healthy',
            status: null,
        };
    }

    if (connection?.versionStatus === 'mismatched') {
        return {
            healthy: false,
            missingCapabilities: [],
            reason: getVersionMismatchReason(connection),
            state: 'unknown',
            status: null,
        };
    }

    const views = capabilities.map((capability) => getSingleCapability(connection, capability));
    const firstUnavailable = views.find((view) => !view.healthy) ?? null;

    return {
        healthy: firstUnavailable === null,
        missingCapabilities: views
            .filter((view) => !view.healthy)
            .map((view) => view.status?.capability ?? view.capability),
        reason: firstUnavailable?.reason ?? (firstUnavailable ? runtimeDisconnectedReason : null),
        state: firstUnavailable?.state ?? 'healthy',
        status: capabilities.length === 1 ? (views[0]?.status ?? null) : null,
    };
}

export function formatCapabilityDisabledReason(capability: CapabilityView): string {
    if (capability.missingCapabilities.length === 0) {
        return capability.reason ?? runtimeDisconnectedReason;
    }

    return `Tavern Runtime degraded: missing ${formatCapabilityList(capability.missingCapabilities)}.`;
}

export function useCapability(): (requirement: CapabilityRequirement) => CapabilityView;
export function useCapability(requirement: CapabilityRequirement): CapabilityView;
export function useCapability(requirement?: CapabilityRequirement) {
    const runtimeConnection = useRuntimeConnection();
    const resolveCapability = React.useCallback(
        (nextRequirement: CapabilityRequirement) =>
            getCapability(runtimeConnection.connection, nextRequirement),
        [runtimeConnection.connection]
    );

    return React.useMemo(
        () => (requirement === undefined ? resolveCapability : resolveCapability(requirement)),
        [requirement, resolveCapability]
    );
}

function getSingleCapability(
    connection: AgentRuntimeConnectionOutput,
    capability: RuntimeCapabilityId
): CapabilityView & { capability: RuntimeCapabilityId } {
    const status =
        connection?.runtimeCapabilities.find((record) => record.capability === capability) ?? null;

    return {
        capability,
        healthy: status?.state === 'healthy',
        missingCapabilities: status?.state === 'healthy' ? [] : [capability],
        reason: status?.reason ?? null,
        state: status?.state ?? 'unknown',
        status,
    };
}

function toCapabilityList(requirement: CapabilityRequirement): readonly RuntimeCapabilityId[] {
    return typeof requirement === 'string' ? [requirement] : requirement;
}

function formatCapabilityList(capabilities: readonly RuntimeCapabilityId[]) {
    const labels = capabilities.map((capability) => capabilityLabels[capability]);

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function getVersionMismatchReason(connection: RuntimeConnection) {
    return compareVersions(connection.runtimeVersion, connection.requiredRuntimeVersion) > 0
        ? 'Tavern update required.'
        : 'Tavern Runtime update required.';
}

function compareVersions(left?: null | string, right?: null | string) {
    if (!(left && right)) {
        return -1;
    }

    const leftParts = toVersionParts(left);
    const rightParts = toVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] ?? 0;
        const rightPart = rightParts[index] ?? 0;
        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    return 0;
}

function toVersionParts(version: string) {
    return version
        .split(/[^\d]+/)
        .filter(Boolean)
        .map((part) => Number(part));
}
