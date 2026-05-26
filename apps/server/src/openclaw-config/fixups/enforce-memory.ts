import type { OpenClawConfigFixup } from './types.ts';

export const requiredOpenClawMemoryConfig = {
    memorySlot: 'none',
} as const;

export const enforceMemoryFixup: OpenClawConfigFixup = {
    apply: async ({ config }) => {
        const fixedConfig = enforceOpenClawMemoryConfig(config);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated OpenClaw memory plugin settings for Tavern.' : null,
        };
    },
    id: 'enforce-memory',
    label: 'Enforce memory settings',
};

export function enforceOpenClawMemoryConfig(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const { installs: _installs, ...openClawPlugins } = plugins;
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
        plugins: {
            ...openClawPlugins,
            allow,
            slots: {
                ...stripRemovedMemorySlots(slots),
                memory: requiredOpenClawMemoryConfig.memorySlot,
            },
            entries: strippedEntries,
        },
    };
}

export function isOpenClawMemoryConfigReady(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const slots = readRecord(plugins.slots);
    const entries = readRecord(plugins.entries);

    return (
        slots.memory === requiredOpenClawMemoryConfig.memorySlot &&
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
