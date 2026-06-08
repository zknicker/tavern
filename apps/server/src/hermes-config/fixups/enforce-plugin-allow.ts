import type { HermesConfigFixup } from './types.ts';

const requiredPluginIds = ['tavern'] as const;

export const enforcePluginAllowFixup: HermesConfigFixup = {
    apply: async ({ config }) => {
        const fixedConfig = enforcePluginAllowlist(config);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated Hermes plugin trust allowlist.' : null,
        };
    },
    id: 'enforce-plugin-allow',
    label: 'Enforce plugin trust allowlist',
};

export function enforcePluginAllowlist(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    const entryIds = Object.keys(readRecord(plugins.entries));
    const allow = uniqueSorted([
        ...readStringArray(plugins.allow),
        ...entryIds,
        ...requiredPluginIds,
    ]);

    return {
        ...config,
        plugins: {
            ...plugins,
            allow,
        },
    };
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

function toStableJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(toStableJson).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => `${JSON.stringify(key)}:${toStableJson(entry)}`)
            .join(',')}}`;
    }

    return JSON.stringify(value);
}
