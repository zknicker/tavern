import {
    collectConfiguredChannelPluginIds,
    readRecord,
    readString,
    readStringArray,
} from './plugin-installs';

export function mergeManagedOpenClawConfig(
    managedConfig: Record<string, unknown>,
    existingConfig: Record<string, unknown> | null | undefined
) {
    if (!existingConfig) {
        return managedConfig;
    }

    const sanitizedExistingConfig = stripRemovedManagedOpenClawPlugins(existingConfig);
    const existingChannels = readRecord(sanitizedExistingConfig.channels);
    const managedChannels = readRecord(managedConfig.channels);

    return {
        ...sanitizedExistingConfig,
        ...managedConfig,
        agents: mergeManagedAgents(
            readRecord(managedConfig.agents),
            readRecord(sanitizedExistingConfig.agents)
        ),
        bindings: sanitizedExistingConfig.bindings ?? managedConfig.bindings,
        channels: {
            ...existingChannels,
            ...managedChannels,
        },
        messages: mergeRecords(
            readRecord(managedConfig.messages),
            readRecord(sanitizedExistingConfig.messages)
        ),
        plugins: mergeManagedPlugins(
            readRecord(managedConfig.plugins),
            readRecord(sanitizedExistingConfig.plugins),
            existingChannels
        ),
    };
}

export function stripRemovedManagedOpenClawPlugins(
    config: Record<string, unknown>
): Record<string, unknown> {
    const plugins = readRecord(config.plugins);
    const entries = readRecord(plugins.entries);
    const installs = readRecord(plugins.installs);
    const allow = readStringArray(plugins.allow).filter(
        (pluginId) => !removedManagedOpenClawPluginIds.has(pluginId)
    );
    const strippedEntries = Object.fromEntries(
        Object.entries(entries).filter(
            ([pluginId]) => !removedManagedOpenClawPluginIds.has(pluginId)
        )
    );
    const strippedInstalls = Object.fromEntries(
        Object.entries(installs).filter(
            ([pluginId]) => !removedManagedOpenClawPluginIds.has(pluginId)
        )
    );

    return {
        ...config,
        plugins: {
            ...plugins,
            allow,
            entries: strippedEntries,
            installs: strippedInstalls,
        },
    };
}

function mergeManagedAgents(
    managedAgents: Record<string, unknown>,
    existingAgents: Record<string, unknown>
) {
    const existingList = readRecordArray(existingAgents.list);
    const managedList = readRecordArray(managedAgents.list);

    return {
        ...existingAgents,
        ...managedAgents,
        list: mergeAgentList(managedList, existingList),
    };
}

function mergeAgentList(
    managedList: Record<string, unknown>[],
    existingList: Record<string, unknown>[]
) {
    const existingById = new Map(
        existingList.flatMap((agent) => {
            const id = readString(agent.id);
            return id ? [[id, agent] as const] : [];
        })
    );
    const managedIds = new Set<string>();
    const mergedManagedAgents = managedList.map((managedAgent) => {
        const id = readString(managedAgent.id);
        if (!id) {
            return managedAgent;
        }

        managedIds.add(id);
        return {
            ...existingById.get(id),
            ...managedAgent,
        };
    });
    const customAgents = existingList.filter((agent) => {
        const id = readString(agent.id);
        return id && !managedIds.has(id);
    });

    return [...mergedManagedAgents, ...customAgents];
}

function mergeManagedPlugins(
    managedPlugins: Record<string, unknown>,
    existingPlugins: Record<string, unknown>,
    existingChannels: Record<string, unknown>
) {
    const allow = [
        ...new Set([
            ...readStringArray(managedPlugins.allow),
            ...readStringArray(existingPlugins.allow),
            ...collectConfiguredChannelPluginIds(existingChannels),
        ]),
    ];

    return {
        ...existingPlugins,
        ...managedPlugins,
        allow,
        entries: mergeRecords(
            readRecord(existingPlugins.entries),
            readRecord(managedPlugins.entries)
        ),
        installs: mergeRecords(
            readRecord(existingPlugins.installs),
            readRecord(managedPlugins.installs)
        ),
    };
}

function mergeRecords(base: Record<string, unknown>, overlay: Record<string, unknown>) {
    return {
        ...base,
        ...overlay,
    };
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

const removedManagedOpenClawPluginIds = new Set(['active-memory', 'memory-core']);
