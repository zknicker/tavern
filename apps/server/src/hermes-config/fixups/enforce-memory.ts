import type { HermesConfigFixup } from './types.ts';

export const requiredHermesMemoryConfig = {
    memoryEnabled: true,
    provider: '',
    memorySlot: 'none',
    userProfileEnabled: true,
} as const;

export const enforceMemoryFixup: HermesConfigFixup = {
    apply: async ({ config }) => {
        const fixedConfig = enforceHermesMemoryConfig(config);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated Hermes memory settings for Tavern.' : null,
        };
    },
    id: 'enforce-memory',
    label: 'Enforce memory settings',
};

export function enforceHermesMemoryConfig(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const { installs: _installs, ...hermesPlugins } = plugins;
    const slots = readRecord(plugins.slots);
    const entries = readRecord(plugins.entries);
    const strippedEntries = stripRemovedMemoryPlugins(entries);
    const allow = uniqueSorted([
        ...readStringArray(plugins.allow).filter(
            (pluginId) => !removedMemoryPluginIds.has(pluginId)
        ),
    ]);

    return {
        ...config,
        memory: {
            ...readRecord(config.memory),
            memory_enabled: requiredHermesMemoryConfig.memoryEnabled,
            provider: requiredHermesMemoryConfig.provider,
            user_profile_enabled: requiredHermesMemoryConfig.userProfileEnabled,
        },
        plugins: {
            ...hermesPlugins,
            allow,
            slots: {
                ...stripRemovedMemorySlots(slots),
                memory: requiredHermesMemoryConfig.memorySlot,
            },
            entries: strippedEntries,
        },
    };
}

export function isHermesMemoryConfigReady(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const slots = readRecord(plugins.slots);
    const entries = readRecord(plugins.entries);
    const memory = readRecord(config.memory);

    return (
        memory.provider === requiredHermesMemoryConfig.provider &&
        memory.memory_enabled === requiredHermesMemoryConfig.memoryEnabled &&
        memory.user_profile_enabled === requiredHermesMemoryConfig.userProfileEnabled &&
        slots.memory === requiredHermesMemoryConfig.memorySlot &&
        !Object.keys(entries).some((pluginId) => removedMemoryPluginIds.has(pluginId)) &&
        !readStringArray(plugins.allow).some((pluginId) => removedMemoryPluginIds.has(pluginId))
    );
}

function stripRemovedMemoryPlugins(record: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(record).filter(([pluginId]) => !removedMemoryPluginIds.has(pluginId))
    );
}

function stripRemovedMemorySlots(slots: Record<string, unknown>) {
    if (!removedMemoryPluginIds.has(readString(slots.contextEngine) ?? '')) {
        return slots;
    }

    const { contextEngine: _contextEngine, ...slotsWithoutRemovedContextEngine } = slots;
    return slotsWithoutRemovedContextEngine;
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : [];
}

function uniqueSorted(values: string[]) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toStableJson(value: unknown) {
    return JSON.stringify(sortJson(value));
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const removedMemoryPluginIds = new Set(['active-memory', 'memory-core', 'lossless-claw']);

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
