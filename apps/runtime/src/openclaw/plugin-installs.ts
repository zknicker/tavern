import path from 'node:path';

export interface ManagedOpenClawPluginInstallSpec {
    installPath: string;
    npmSpec: string;
    packageName: string;
    pluginId: string;
}

export function resolveManagedOpenClawPluginInstallSpecs(input: {
    config: Record<string, unknown>;
    installRoot: string | null | undefined;
    version: string;
}) {
    const installRoot = input.installRoot;
    if (!installRoot) {
        return [];
    }

    const specs = new Map<string, ManagedOpenClawPluginInstallSpec>();
    for (const spec of resolveConfiguredChannelPluginInstallSpecs({
        config: input.config,
        installRoot,
        version: input.version,
    })) {
        if (!specs.has(spec.pluginId)) {
            specs.set(spec.pluginId, spec);
        }
    }

    return Array.from(specs.values());
}

export function resolveDefaultManagedOpenClawPluginInstallSpecs(input: {
    installRoot: string | null | undefined;
}) {
    const installRoot = input.installRoot;
    if (!installRoot) {
        return [];
    }

    return [] satisfies ManagedOpenClawPluginInstallSpec[];
}

export function applyManagedOpenClawPluginInstallSpecs(
    config: Record<string, unknown>,
    specs: ManagedOpenClawPluginInstallSpec[]
) {
    const installConfig = stripManagedOpenClawPluginInstalls(config);
    if (specs.length === 0) {
        return installConfig;
    }

    const plugins = readRecord(installConfig.plugins);
    const load = readRecord(plugins.load);

    return {
        ...installConfig,
        plugins: {
            ...plugins,
            load: {
                ...load,
                paths: [
                    ...new Set([
                        ...readStringArray(load.paths),
                        ...specs.map((spec) => spec.installPath),
                    ]),
                ],
            },
        },
    };
}

export function stripManagedOpenClawPluginInstalls(config: Record<string, unknown>) {
    const plugins = readRecord(config.plugins);
    if (!('installs' in plugins)) {
        return config;
    }

    const { installs: _installs, ...pluginsWithoutInstalls } = plugins;
    return {
        ...config,
        plugins: pluginsWithoutInstalls,
    };
}

function resolveConfiguredChannelPluginInstallSpecs(input: {
    config: Record<string, unknown>;
    installRoot: string;
    version: string;
}) {
    return collectConfiguredChannelPluginIds(readRecord(input.config.channels)).flatMap(
        (pluginId) => {
            if (managedOpenClawPluginIds.has(pluginId) || !isManagedPluginId(pluginId)) {
                return [];
            }

            const packageName = `@openclaw/${pluginId}`;
            return [
                {
                    installPath: resolveManagedPackageRoot(input.installRoot, packageName),
                    npmSpec: `${packageName}@${input.version}`,
                    packageName,
                    pluginId,
                },
            ];
        }
    );
}

export function collectConfiguredChannelPluginIds(channels: Record<string, unknown>) {
    return Object.entries(channels).flatMap(([channelId, config]) => {
        if (channelId === 'defaults') {
            return [];
        }

        const channelConfig = readRecord(config);
        if (readBoolean(channelConfig.enabled) === false) {
            return [];
        }

        return readString(channelId) ?? [];
    });
}

function resolveManagedPackageRoot(installRoot: string, packageName: string) {
    return path.join(installRoot, 'node_modules', ...packageName.split('/'));
}

function isManagedPluginId(pluginId: string) {
    return /^[a-z][a-z0-9-]{0,63}$/u.test(pluginId);
}

const managedOpenClawPluginIds = new Set([
    'tavern',
    'tavern-cortex',
    'tavern-workspace',
    'codex',
    'memory-core',
    'openai',
]);

export function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.flatMap((entry) => readString(entry) ?? []) : [];
}

export function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : null;
}
