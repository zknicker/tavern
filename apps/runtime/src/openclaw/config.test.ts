import { describe, expect, it } from 'vitest';

import { buildManagedOpenClawConfig } from './config';
import { resolveManagedOpenClawPluginInstallSpecs } from './plugin-installs';

describe('buildManagedOpenClawConfig', () => {
    it('includes Tavern-managed OpenClaw defaults', () => {
        const config = buildManagedOpenClawConfig({
            codexPluginRoot:
                '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@openclaw/codex',
            gatewayPort: 18_789,
            gatewayToken: 'token',
            openClawInstallRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(config).toMatchObject({
            agents: {
                defaults: {
                    maxConcurrent: 4,
                    model: 'openai/gpt-5.5',
                    models: {
                        'openai/gpt-5.5': {
                            agentRuntime: {
                                id: 'codex',
                            },
                        },
                    },
                    sandbox: {
                        backend: 'none',
                        mode: 'off',
                    },
                    subagents: {
                        maxConcurrent: 8,
                    },
                    workspace: '/Users/me/.tavern/runtime/openclaw/run/workspace',
                },
            },
            commands: {
                native: 'auto',
                nativeSkills: 'auto',
                ownerDisplay: 'raw',
                restart: true,
            },
            messages: {
                ackReactionScope: 'group-mentions',
                groupChat: {
                    visibleReplies: 'message_tool',
                },
            },
            meta: {
                lastTouchedVersion: '2026.5.12',
            },
            plugins: {
                allow: ['tavern', 'tavern-cortex', 'tavern-workspace', 'codex', 'openai'],
                entries: {
                    tavern: {
                        enabled: true,
                    },
                    'tavern-cortex': {
                        enabled: true,
                    },
                    'tavern-workspace': {
                        enabled: true,
                    },
                    codex: {
                        config: {
                            computerUse: {
                                autoInstall: true,
                                enabled: true,
                                mcpServerName: 'computer-use',
                                pluginName: 'computer-use',
                            },
                        },
                        enabled: true,
                    },
                    openai: {
                        config: {
                            personality: 'friendly',
                        },
                        enabled: true,
                    },
                },
                load: {
                    paths: [
                        '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
                        '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
                        '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
                        '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@openclaw/codex',
                    ],
                },
                slots: {
                    memory: 'none',
                },
            },
        });
    });

    it('preserves user-managed Discord config when rebuilding managed defaults', () => {
        const config = buildManagedOpenClawConfig({
            existingConfig: {
                agents: {
                    list: [
                        {
                            groupChat: {
                                mentionPatterns: ['@tavern'],
                            },
                            id: 'main',
                        },
                    ],
                },
                bindings: [
                    {
                        agentId: 'main',
                        match: {
                            channel: '123',
                            platform: 'discord',
                            server: '456',
                        },
                        type: 'route',
                    },
                ],
                channels: {
                    discord: {
                        accounts: {
                            default: {
                                enabled: true,
                                token: 'secret-token',
                            },
                        },
                    },
                },
            },
            gatewayPort: 18_789,
            gatewayToken: 'token',
            openClawInstallRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(config).toMatchObject({
            agents: {
                list: [
                    {
                        groupChat: {
                            mentionPatterns: ['@tavern'],
                        },
                        id: 'main',
                        name: 'main',
                    },
                ],
            },
            bindings: [
                {
                    agentId: 'main',
                    match: {
                        channel: '123',
                        platform: 'discord',
                        server: '456',
                    },
                    type: 'route',
                },
            ],
            channels: {
                tavern: {},
                discord: {
                    accounts: {
                        default: {
                            enabled: true,
                            token: 'secret-token',
                        },
                    },
                },
            },
            plugins: {
                allow: expect.arrayContaining([
                    'tavern',
                    'tavern-cortex',
                    'tavern-workspace',
                    'codex',
                    'discord',
                    'openai',
                ]),
            },
        });
        expect(getPluginLoadPaths(config)).toEqual(
            expect.arrayContaining([
                '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@openclaw/discord',
            ])
        );
        expect(
            resolveManagedOpenClawPluginInstallSpecs({
                config,
                installRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
                version: '2026.5.12',
            })
        ).toEqual([
            {
                installPath:
                    '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@openclaw/discord',
                npmSpec: '@openclaw/discord@2026.5.12',
                packageName: '@openclaw/discord',
                pluginId: 'discord',
            },
        ]);
    });

    it('can pin the Codex app-server auth profile without storing credentials', () => {
        const config = buildManagedOpenClawConfig({
            codexAuthProfileId: 'openai-codex:user@example.com',
            existingConfig: {
                auth: {
                    profiles: {
                        'anthropic:default': {
                            mode: 'api_key',
                            provider: 'anthropic',
                        },
                    },
                },
            },
            gatewayPort: 18_789,
            gatewayToken: 'token',
            openClawInstallRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(config).toMatchObject({
            auth: {
                order: {
                    'openai-codex': ['openai-codex:user@example.com'],
                },
                profiles: {
                    'anthropic:default': {
                        mode: 'api_key',
                        provider: 'anthropic',
                    },
                    'openai-codex:user@example.com': {
                        mode: 'oauth',
                        provider: 'openai-codex',
                    },
                },
            },
        });
    });

    it('removes stale memory plugins from existing managed config', () => {
        const config = buildManagedOpenClawConfig({
            existingConfig: {
                plugins: {
                    allow: ['active-memory', 'memory-core', 'lossless-claw', 'discord'],
                    entries: {
                        'active-memory': {
                            enabled: true,
                        },
                        'memory-core': {
                            enabled: true,
                        },
                        'lossless-claw': {
                            enabled: true,
                        },
                        discord: {
                            enabled: true,
                        },
                    },
                    installs: {
                        'active-memory': {
                            source: 'npm',
                            spec: '@openclaw/active-memory@2026.5.12',
                        },
                        'memory-core': {
                            source: 'npm',
                            spec: '@openclaw/memory-core@2026.5.12',
                        },
                    },
                    slots: {
                        contextEngine: 'lossless-claw',
                        memory: 'none',
                    },
                },
            },
            gatewayPort: 18_789,
            gatewayToken: 'token',
            openClawInstallRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(getPluginAllow(config)).not.toContain('active-memory');
        expect(getPluginAllow(config)).not.toContain('memory-core');
        expect(getPluginAllow(config)).not.toContain('lossless-claw');
        expect(getPluginEntries(config)).not.toHaveProperty('active-memory');
        expect(getPluginEntries(config)).not.toHaveProperty('memory-core');
        expect(getPluginEntries(config)).not.toHaveProperty('lossless-claw');
        expect(getPluginSlots(config)).not.toHaveProperty('contextEngine');
        expect(hasPluginInstalls(config)).toBe(false);
    });

    it('strips non-standard plugin install records from authored config', () => {
        const config = buildManagedOpenClawConfig({
            existingConfig: {
                plugins: {
                    allow: ['openclaw-weixin'],
                    entries: {
                        'openclaw-weixin': {
                            enabled: true,
                        },
                    },
                    installs: {
                        'openclaw-weixin': {
                            source: 'npm',
                            spec: '@tencent-weixin/openclaw-weixin@1.2.3',
                        },
                    },
                },
            },
            gatewayPort: 18_789,
            gatewayToken: 'token',
            openClawInstallRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(config).toMatchObject({
            plugins: {
                allow: expect.arrayContaining(['openclaw-weixin']),
                entries: {
                    'openclaw-weixin': {
                        enabled: true,
                    },
                },
            },
        });
        expect(hasPluginInstalls(config)).toBe(false);
        expect(getPluginLoadPaths(config)).not.toContain(
            '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@tencent-weixin/openclaw-weixin'
        );
    });

    it('does not request installs for disabled channel plugins', () => {
        const config = buildManagedOpenClawConfig({
            existingConfig: {
                channels: {
                    discord: {
                        enabled: false,
                    },
                },
            },
            gatewayPort: 18_789,
            gatewayToken: 'token',
            cortexPluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-cortex',
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
            workspacePluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-workspace',
            workspaceDir: '/Users/me/.tavern/runtime/openclaw/run/workspace',
        });

        expect(
            resolveManagedOpenClawPluginInstallSpecs({
                config,
                installRoot: '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12',
                version: '2026.5.12',
            })
        ).toEqual([]);
    });
});

function getPluginLoadPaths(config: Record<string, unknown>) {
    const plugins = getPlugins(config);
    const load =
        'load' in plugins && typeof plugins.load === 'object' && plugins.load !== null
            ? plugins.load
            : {};
    return 'paths' in load && Array.isArray(load.paths) ? load.paths : [];
}

function hasPluginInstalls(config: Record<string, unknown>) {
    const plugins = getPlugins(config);
    return 'installs' in plugins;
}

function getPluginEntries(config: Record<string, unknown>) {
    const plugins = getPlugins(config);
    return 'entries' in plugins && typeof plugins.entries === 'object' && plugins.entries !== null
        ? plugins.entries
        : {};
}

function getPluginSlots(config: Record<string, unknown>) {
    const plugins = getPlugins(config);
    return 'slots' in plugins && typeof plugins.slots === 'object' && plugins.slots !== null
        ? plugins.slots
        : {};
}

function getPluginAllow(config: Record<string, unknown>) {
    const plugins = getPlugins(config);
    return 'allow' in plugins && Array.isArray(plugins.allow) ? plugins.allow : [];
}

function getPlugins(config: Record<string, unknown>) {
    return typeof config.plugins === 'object' && config.plugins !== null ? config.plugins : {};
}
