import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityId = RuntimeCapability['capability'];
type CapabilityCategoryId = 'extensions' | 'knowledge' | 'plugins' | 'runtimeCore';
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

const categories: CapabilityCategory[] = [
    { id: 'runtimeCore', label: 'Runtime core' },
    { id: 'knowledge', label: 'Knowledge & memory' },
    { id: 'extensions', label: 'Skills & models' },
    { id: 'plugins', label: 'Plugins' },
];

const capabilityCategories: Partial<Record<CapabilityId, CapabilityCategoryId>> = {
    apiServer: 'runtimeCore',
    codexOAuth: 'runtimeCore',
    dashboardServer: 'runtimeCore',
    gateway: 'runtimeCore',
    modelExecution: 'extensions',
    'plugin.google.calendar': 'plugins',
    'plugin.merchbase': 'plugins',
    skills: 'extensions',
    semanticMemory: 'knowledge',
    memoryRecall: 'knowledge',
};

const capabilityDisplayOrder: CapabilityId[] = [
    'codexOAuth',
    'apiServer',
    'dashboardServer',
    'gateway',
    'semanticMemory',
    'memoryRecall',
    'modelExecution',
    'skills',
    'plugin.merchbase',
    'plugin.google.calendar',
];

const capabilityDisplayRank = new Map(
    capabilityDisplayOrder.map((capability, index) => [capability, index] as const)
);

const requiredCapabilities = new Set<CapabilityId>([
    'apiServer',
    'dashboardServer',
    'gateway',
    'modelExecution',
    'skills',
]);

const supportingCapabilities = new Set<CapabilityId>(['codexOAuth']);

export function getCapabilityLabel(capability: RuntimeCapability) {
    return capability.displayName ?? capability.capability;
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
    const categoryId = capabilityCategories[capability.capability] ?? 'runtimeCore';
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
