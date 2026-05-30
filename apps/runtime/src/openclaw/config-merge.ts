import {
    collectConfiguredChannelPluginIds,
    readRecord,
    readString,
    readStringArray,
    stripManagedOpenClawPluginInstalls,
} from './plugin-installs';

export function mergeManagedOpenClawConfig(
    managedConfig: Record<string, unknown>,
    existingConfig: Record<string, unknown> | null | undefined
) {
    if (!existingConfig) {
        return managedConfig;
    }

    const sanitizedExistingConfig = stripManagedOpenClawPluginInstalls(
        stripRemovedManagedOpenClawPlugins(existingConfig)
    );
    const existingChannels = readRecord(sanitizedExistingConfig.channels);
    const managedChannels = readRecord(managedConfig.channels);
    const auth = mergeManagedAuth(
        readRecord(managedConfig.auth),
        readRecord(sanitizedExistingConfig.auth)
    );

    return {
        ...sanitizedExistingConfig,
        ...managedConfig,
        agents: mergeManagedAgents(
            readRecord(managedConfig.agents),
            readRecord(sanitizedExistingConfig.agents)
        ),
        ...(hasRecordEntries(auth) ? { auth } : {}),
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
        skills: mergeRecords(
            readRecord(sanitizedExistingConfig.skills),
            readRecord(managedConfig.skills)
        ),
    };
}

function mergeManagedAuth(
    managedAuth: Record<string, unknown>,
    existingAuth: Record<string, unknown>
) {
    const order = mergeRecords(readRecord(existingAuth.order), readRecord(managedAuth.order));
    const profiles = mergeRecords(
        readRecord(existingAuth.profiles),
        readRecord(managedAuth.profiles)
    );

    return {
        ...existingAuth,
        ...managedAuth,
        ...(hasRecordEntries(order) ? { order } : {}),
        ...(hasRecordEntries(profiles) ? { profiles } : {}),
    };
}

export function stripRemovedManagedOpenClawPlugins(
    config: Record<string, unknown>
): Record<string, unknown> {
    const plugins = readRecord(config.plugins);
    const { installs: _installs, ...pluginsWithoutInstalls } = plugins;
    const entries = readRecord(plugins.entries);
    const slots = readRecord(plugins.slots);
    const allow = readStringArray(plugins.allow).filter(
        (pluginId) => !removedManagedOpenClawPluginIds.has(pluginId)
    );
    const strippedEntries = Object.fromEntries(
        Object.entries(entries).filter(
            ([pluginId]) => !removedManagedOpenClawPluginIds.has(pluginId)
        )
    );

    return {
        ...config,
        plugins: {
            ...pluginsWithoutInstalls,
            allow,
            entries: strippedEntries,
            slots: stripRemovedManagedOpenClawSlots(slots),
        },
    };
}

function stripRemovedManagedOpenClawSlots(slots: Record<string, unknown>) {
    if (!removedManagedOpenClawPluginIds.has(readString(slots.contextEngine) ?? '')) {
        return slots;
    }

    const { contextEngine: _contextEngine, ...slotsWithoutRemovedContextEngine } = slots;
    return slotsWithoutRemovedContextEngine;
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
    const { installs: _existingInstalls, ...existingOpenClawPlugins } = existingPlugins;
    const { installs: _managedInstalls, ...managedOpenClawPlugins } = managedPlugins;
    const allow = [
        ...new Set([
            ...readStringArray(managedPlugins.allow),
            ...readStringArray(existingPlugins.allow),
            ...collectConfiguredChannelPluginIds(existingChannels),
        ]),
    ];

    return {
        ...existingOpenClawPlugins,
        ...managedOpenClawPlugins,
        allow,
        entries: mergeRecords(
            readRecord(existingPlugins.entries),
            readRecord(managedPlugins.entries)
        ),
    };
}

function mergeRecords(base: Record<string, unknown>, overlay: Record<string, unknown>) {
    return {
        ...base,
        ...overlay,
    };
}

function hasRecordEntries(record: Record<string, unknown>) {
    return Object.keys(record).length > 0;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

const removedManagedOpenClawPluginIds = new Set(['active-memory', 'memory-core', 'lossless-claw']);
