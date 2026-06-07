import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityId = RuntimeCapability['capability'];
type CapabilityCategoryId =
    | 'agentWork'
    | 'automation'
    | 'chatSync'
    | 'extensions'
    | 'knowledge'
    | 'operations'
    | 'runtimeCore';
export type CapabilityCriticality = 'primary' | 'required' | 'supporting';

export interface CapabilityView {
    category: CapabilityCategory;
    criticality: CapabilityCriticality;
    item: RuntimeCapability;
    label: string;
}

interface CapabilityCategory {
    id: CapabilityCategoryId;
    label: string;
}

const capabilityLabels: Partial<Record<CapabilityId, string>> = {
    computerUse: 'computer use',
    cronRuns: 'cron runs',
    cortexAgentTools: 'Cortex agent tools',
    cortexImportProcessors: 'Cortex import processors',
    cortexJobs: 'Cortex jobs',
    cortexModelAccess: 'Cortex model access',
    embeddingModel: 'embedding model',
    mentions: 'mentions',
};

const categories: CapabilityCategory[] = [
    { id: 'runtimeCore', label: 'Runtime core' },
    { id: 'agentWork', label: 'Agent work' },
    { id: 'chatSync', label: 'Chat & sync' },
    { id: 'knowledge', label: 'Knowledge & memory' },
    { id: 'extensions', label: 'Skills & models' },
    { id: 'automation', label: 'Automation' },
    { id: 'operations', label: 'Operations' },
];

const capabilityCategories: Partial<Record<CapabilityId, CapabilityCategoryId>> = {
    agentFiles: 'agentWork',
    agentTurns: 'agentWork',
    agents: 'agentWork',
    chats: 'chatSync',
    chatTargets: 'chatSync',
    codexOAuth: 'runtimeCore',
    computerUse: 'agentWork',
    cortexAgentTools: 'knowledge',
    cortexDatabase: 'knowledge',
    cortexImportProcessors: 'knowledge',
    cortexJobs: 'knowledge',
    cortexModelAccess: 'knowledge',
    cortexWiki: 'knowledge',
    cron: 'automation',
    cronRuns: 'automation',
    embeddingModel: 'knowledge',
    events: 'operations',
    gateway: 'runtimeCore',
    knowledgebase: 'knowledge',
    logs: 'operations',
    memory: 'knowledge',
    mentions: 'chatSync',
    messages: 'chatSync',
    models: 'extensions',
    sessionEvents: 'chatSync',
    sessions: 'chatSync',
    skillMaterialization: 'extensions',
    skills: 'extensions',
    status: 'runtimeCore',
    tasks: 'agentWork',
    tavernPlugin: 'runtimeCore',
};

const capabilityDisplayOrder: CapabilityId[] = [
    'status',
    'gateway',
    'tavernPlugin',
    'codexOAuth',
    'agents',
    'agentTurns',
    'agentFiles',
    'computerUse',
    'tasks',
    'chats',
    'messages',
    'sessions',
    'chatTargets',
    'mentions',
    'sessionEvents',
    'cortexDatabase',
    'cortexWiki',
    'knowledgebase',
    'cortexAgentTools',
    'cortexImportProcessors',
    'cortexJobs',
    'cortexModelAccess',
    'embeddingModel',
    'memory',
    'models',
    'skills',
    'skillMaterialization',
    'cron',
    'cronRuns',
    'events',
    'logs',
];

const capabilityDisplayRank = new Map(
    capabilityDisplayOrder.map((capability, index) => [capability, index] as const)
);

const requiredCapabilities = new Set<CapabilityId>([
    'agents',
    'chats',
    'codexOAuth',
    'cortexAgentTools',
    'cortexDatabase',
    'cortexJobs',
    'cortexWiki',
    'gateway',
    'messages',
    'models',
    'sessions',
    'skills',
    'status',
    'tavernPlugin',
]);

const supportingCapabilities = new Set<CapabilityId>([
    'agentFiles',
    'events',
    'logs',
    'sessionEvents',
    'tasks',
]);

export function getCapabilityLabel(capability: RuntimeCapability) {
    return capabilityLabels[capability.capability] ?? capability.capability;
}

export function groupCapabilities(capabilities: RuntimeConnection['capabilities']) {
    const views = capabilities.map((item): CapabilityView => {
        return {
            category: getCapabilityCategory(item),
            criticality: getCapabilityCriticality(item),
            item,
            label: getCapabilityLabel(item),
        };
    });

    return categories
        .map((category) => ({
            category,
            items: views
                .filter((view) => view.category.id === category.id)
                .sort(compareCapabilities),
        }))
        .filter((group) => group.items.length > 0);
}

function getCapabilityCriticality(capability: RuntimeCapability): CapabilityCriticality {
    if (requiredCapabilities.has(capability.capability)) {
        return 'required';
    }
    if (supportingCapabilities.has(capability.capability)) {
        return 'supporting';
    }
    return 'primary';
}

function getCapabilityCategory(capability: RuntimeCapability): CapabilityCategory {
    const categoryId = capabilityCategories[capability.capability] ?? 'operations';
    return categories.find((category) => category.id === categoryId) ?? categories.at(-1)!;
}

function compareCapabilities(a: CapabilityView, b: CapabilityView) {
    const aRank = capabilityDisplayRank.get(a.item.capability);
    const bRank = capabilityDisplayRank.get(b.item.capability);
    if (aRank !== undefined && bRank !== undefined && aRank !== bRank) {
        return aRank - bRank;
    }
    if (aRank !== undefined) {
        return -1;
    }
    if (bRank !== undefined) {
        return 1;
    }

    return a.label.localeCompare(b.label);
}
