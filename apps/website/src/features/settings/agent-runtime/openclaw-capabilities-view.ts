import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityState = RuntimeCapability['state'];
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
    cortexDatabase: 'knowledge',
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

const requiredCapabilities = new Set<CapabilityId>([
    'agents',
    'chats',
    'codexOAuth',
    'cortexDatabase',
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

const criticalityRank: Record<CapabilityCriticality, number> = {
    required: 0,
    primary: 1,
    supporting: 2,
};

const stateRank: Record<CapabilityState, number> = {
    unavailable: 0,
    unauthorized: 1,
    degraded: 2,
    unknown: 3,
    healthy: 4,
};

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
    const criticality = criticalityRank[a.criticality] - criticalityRank[b.criticality];
    if (criticality !== 0) {
        return criticality;
    }

    const state = stateRank[a.item.state] - stateRank[b.item.state];
    if (state !== 0) {
        return state;
    }

    return a.label.localeCompare(b.label);
}
