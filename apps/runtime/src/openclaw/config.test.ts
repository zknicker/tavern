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
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
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
                allow: ['tavern', 'codex', 'memory-core', 'openai'],
                entries: {
                    tavern: {
                        enabled: true,
                    },
                    codex: {
                        enabled: true,
                    },
                    'memory-core': {
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
                        '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@openclaw/codex',
                    ],
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
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
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
                    'codex',
                    'discord',
                    'memory-core',
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

    it('uses generic npm plugin install records without writing them to authored config', () => {
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
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
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
        expect(getPluginInstalls(config)).toEqual({});
        expect(getPluginLoadPaths(config)).toEqual(
            expect.arrayContaining([
                '/Users/me/.tavern/runtime/openclaw/versions/2026.5.12/node_modules/@tencent-weixin/openclaw-weixin',
            ])
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
            pluginPath: '/Users/me/.tavern/openclaw-plugins/tavern-openclaw-messenger',
            version: '2026.5.12',
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
    const plugins =
        typeof config.plugins === 'object' && config.plugins !== null ? config.plugins : {};
    const load =
        'load' in plugins && typeof plugins.load === 'object' && plugins.load !== null
            ? plugins.load
            : {};
    return 'paths' in load && Array.isArray(load.paths) ? load.paths : [];
}

function getPluginInstalls(config: Record<string, unknown>) {
    const plugins =
        typeof config.plugins === 'object' && config.plugins !== null ? config.plugins : {};
    return 'installs' in plugins &&
        typeof plugins.installs === 'object' &&
        plugins.installs !== null
        ? plugins.installs
        : {};
}
