import type { OpenClawConfigFixup } from './types.ts';

export const requiredOpenClawMemoryConfig = {
    contextEngine: 'lossless-claw',
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
    const losslessClaw = readRecord(entries['lossless-claw']);
    const strippedEntries = stripRemovedMemoryPlugins(entries);
    const allow = uniqueSorted([
        ...readStringArray(plugins.allow).filter(
            (pluginId) => !removedMemoryPluginIds.has(pluginId)
        ),
        requiredOpenClawMemoryConfig.contextEngine,
    ]);

    return {
        ...config,
        plugins: {
            ...openClawPlugins,
            allow,
            slots: {
                ...slots,
                contextEngine: requiredOpenClawMemoryConfig.contextEngine,
                memory: requiredOpenClawMemoryConfig.memorySlot,
            },
            entries: {
                ...strippedEntries,
                'lossless-claw': {
                    ...losslessClaw,
                    enabled: true,
                },
            },
        },
    };
}

export function isOpenClawMemoryConfigReady(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const slots = readRecord(plugins.slots);
    const entries = readRecord(plugins.entries);
    const losslessClaw = readRecord(entries['lossless-claw']);

    return (
        slots.contextEngine === requiredOpenClawMemoryConfig.contextEngine &&
        slots.memory === requiredOpenClawMemoryConfig.memorySlot &&
        losslessClaw.enabled === true &&
        isPluginAllowed(plugins, requiredOpenClawMemoryConfig.contextEngine) &&
        !Object.keys(entries).some((pluginId) => removedMemoryPluginIds.has(pluginId)) &&
        !readStringArray(plugins.allow).some((pluginId) => removedMemoryPluginIds.has(pluginId))
    );
}

function stripRemovedMemoryPlugins(record: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(record).filter(([pluginId]) => !removedMemoryPluginIds.has(pluginId))
    );
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

function isPluginAllowed(plugins: Record<string, unknown>, pluginId: string) {
    const allow = readStringArray(plugins.allow);
    return allow.length === 0 || allow.includes(pluginId);
}

function uniqueSorted(values: string[]) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function toStableJson(value: unknown) {
    return JSON.stringify(sortJson(value));
}

const removedMemoryPluginIds = new Set(['active-memory', 'memory-core']);

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
