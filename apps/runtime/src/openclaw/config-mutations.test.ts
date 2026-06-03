import { OpenClawSchema } from 'openclaw/plugin-sdk/config-schema';
import { describe, expect, test } from 'vitest';

import {
    applyOpenClawConfigMutation,
    deleteDiscordBindingConfig,
    updateAgentModelConfig,
    updateAgentNameConfig,
    updateAgentThinkingDefaultConfig,
    upsertDiscordBindingConfig,
} from './config-mutations';
import { readDiscordBindings } from './discord-bindings';

describe('OpenClaw config domain mutations', () => {
    test('updates only the selected agent name', () => {
        const config = {
            agents: {
                list: [
                    { id: 'main', name: 'main', tools: { allow: ['read'] } },
                    { id: 'other', name: 'Other' },
                ],
            },
        };

        expect(
            updateAgentNameConfig(config, 'main', {
                name: 'Blippy',
            }).agents
        ).toEqual({
            list: [
                { id: 'main', name: 'Blippy', tools: { allow: ['read'] } },
                { id: 'other', name: 'Other' },
            ],
        });
    });

    test('updates agent model and harness config', () => {
        const config = {
            agents: {
                list: [
                    {
                        id: 'main',
                        model: { primary: 'openai/gpt-5.4' },
                        models: {
                            'openai/gpt-5.4': {},
                        },
                    },
                ],
            },
        };

        const next = updateAgentModelConfig(config, 'main', {
            model: {
                harness: 'codex',
                model: 'gpt-5.5',
                provider: 'openai',
            },
        });

        expect(next.agents).toEqual({
            list: [
                {
                    id: 'main',
                    model: {
                        fallbacks: [],
                        primary: 'openai/gpt-5.5',
                    },
                    models: {
                        'openai/gpt-5.4': {},
                        'openai/gpt-5.5': {
                            agentRuntime: {
                                id: 'codex',
                            },
                        },
                    },
                },
            ],
        });
    });

    test('sets and clears agent thinking default', () => {
        const config = updateAgentThinkingDefaultConfig(
            { agents: { list: [{ id: 'main' }] } },
            'main',
            {
                thinkingDefault: 'high',
            }
        );

        expect(config.agents).toEqual({
            list: [{ id: 'main', thinkingDefault: 'high' }],
        });

        expect(
            updateAgentThinkingDefaultConfig(config, 'main', {
                thinkingDefault: null,
            }).agents
        ).toEqual({
            list: [{ id: 'main' }],
        });
    });

    test('upserts and deletes Discord binding config', () => {
        const config = {
            agents: {
                list: [{ id: 'main', name: 'main' }],
            },
            bindings: [],
            channels: {
                discord: {
                    accounts: {},
                },
            },
        };

        const saved = upsertDiscordBindingConfig(config, {
            agentId: 'main',
            allowBots: 'mentions',
            bindingId: 'discord:main',
            enabled: true,
            groupPolicy: 'allowlist',
            guilds: [
                {
                    channelIds: ['456'],
                    id: '123',
                    ignoreOtherMentions: true,
                    requireMention: true,
                },
            ],
            inboundMode: 'mention-only',
            match: {
                dmUserIds: ['789'],
                parentChannelIds: ['456'],
            },
            mentionPatterns: ['@Blippy'],
            metadata: { source: 'settings' },
            name: 'Blippy Discord',
            replyToMode: 'first',
            token: 'secret',
        });

        expect(saved.bindings).toEqual([
            {
                agentId: 'main',
                match: {
                    accountId: 'main',
                    channel: 'discord',
                },
            },
        ]);
        expect(saved.channels).toEqual({
            discord: {
                accounts: {
                    main: {
                        allowBots: 'mentions',
                        enabled: true,
                        groupPolicy: 'allowlist',
                        guilds: {
                            '123': {
                                channels: {
                                    '456': {
                                        enabled: true,
                                        requireMention: true,
                                    },
                                },
                                ignoreOtherMentions: true,
                                requireMention: true,
                            },
                        },
                        name: 'Blippy Discord',
                        replyToMode: 'first',
                        tavern: {
                            inboundMode: 'mention-only',
                            match: {
                                dmUserIds: ['789'],
                                parentChannelIds: ['456'],
                            },
                            metadata: { source: 'settings' },
                        },
                        token: 'secret',
                    },
                },
            },
        });
        expect(saved.agents).toEqual({
            list: [
                {
                    groupChat: {
                        mentionPatterns: ['@Blippy'],
                    },
                    id: 'main',
                    name: 'main',
                },
            ],
        });
        expect(OpenClawSchema.safeParse(saved).success).toBe(true);
        expect(readDiscordBindings(saved)).toEqual([
            {
                accountId: 'main',
                agentId: 'main',
                allowBots: 'mentions',
                enabled: true,
                groupPolicy: 'allowlist',
                guilds: [
                    {
                        channelIds: ['456'],
                        id: '123',
                        ignoreOtherMentions: true,
                        requireMention: true,
                    },
                ],
                id: 'discord:main:main:0',
                inboundMode: 'mention-only',
                match: {
                    channelIds: ['456'],
                    dmUserIds: ['789'],
                    guildIds: ['123'],
                    parentChannelIds: ['456'],
                },
                mentionPatterns: ['@Blippy'],
                metadata: { source: 'settings' },
                name: 'Blippy Discord',
                platform: 'discord',
                replyToMode: 'first',
                status: 'configured',
                statusMessage: null,
                tokenConfigured: true,
                tokenSource: 'plaintext',
            },
        ]);

        expect(deleteDiscordBindingConfig(saved, 'discord:main:main:0', {}).bindings).toEqual([]);
    });

    test('preserves OpenClaw route fields when updating an existing Discord binding', () => {
        const saved = upsertDiscordBindingConfig(
            {
                bindings: [
                    {
                        agentId: 'main',
                        comment: 'existing route',
                        match: {
                            accountId: 'main',
                            channel: 'discord',
                            guildId: 'guild-1',
                            peer: {
                                id: 'channel-1',
                                kind: 'channel',
                            },
                            roles: ['admin'],
                            teamId: 'team-1',
                        },
                        session: {
                            dmScope: 'per-channel-peer',
                        },
                        type: 'route',
                    },
                ],
                channels: {
                    discord: {
                        accounts: {
                            main: {
                                token: 'secret',
                            },
                        },
                    },
                },
            },
            {
                agentId: 'main',
                allowBots: false,
                bindingId: 'discord:main:main:0',
                enabled: true,
                groupPolicy: 'open',
                guilds: [],
                inboundMode: 'active',
                match: {
                    dmUserIds: [],
                    parentChannelIds: [],
                },
                mentionPatterns: [],
                metadata: {},
                name: 'Main Discord',
                replyToMode: 'off',
                token: '',
            }
        );

        expect(saved.bindings).toEqual([
            {
                agentId: 'main',
                comment: 'existing route',
                match: {
                    accountId: 'main',
                    channel: 'discord',
                    guildId: 'guild-1',
                    peer: {
                        id: 'channel-1',
                        kind: 'channel',
                    },
                    roles: ['admin'],
                    teamId: 'team-1',
                },
                session: {
                    dmScope: 'per-channel-peer',
                },
                type: 'route',
            },
        ]);
        expect(OpenClawSchema.safeParse(saved).success).toBe(true);
    });

    test('reads and deletes Discord bindings with an implicit default account', () => {
        const config = {
            bindings: [
                {
                    agentId: 'main',
                    match: {
                        channel: 'discord',
                    },
                    type: 'route',
                },
            ],
            channels: {
                discord: {
                    accounts: {
                        default: {
                            name: 'Default Discord',
                            token: 'secret',
                        },
                    },
                    groupPolicy: 'open',
                },
            },
        };

        expect(readDiscordBindings(config)).toEqual([
            expect.objectContaining({
                accountId: 'default',
                agentId: 'main',
                id: 'discord:default:main:0',
                name: 'Default Discord',
                platform: 'discord',
            }),
        ]);
        expect(OpenClawSchema.safeParse(config).success).toBe(true);
        const deleted = deleteDiscordBindingConfig(config, 'discord:default:main:0', {});
        const deletedChannels = deleted.channels as {
            discord: { accounts: Record<string, unknown> };
        };
        expect(deleted.bindings).toEqual([]);
        expect(deletedChannels.discord.accounts).toEqual({});
    });

    test('derives per-route Discord binding ids for shared accounts', () => {
        const config = {
            bindings: [
                {
                    agentId: 'main',
                    match: {
                        accountId: 'shared',
                        channel: 'discord',
                        guildId: 'guild-1',
                    },
                    type: 'route',
                },
                {
                    agentId: 'main',
                    match: {
                        accountId: 'shared',
                        channel: 'discord',
                        guildId: 'guild-2',
                    },
                    type: 'route',
                },
            ],
            channels: {
                discord: {
                    accounts: {
                        shared: {
                            name: 'Shared Discord',
                            token: 'secret',
                        },
                    },
                },
            },
        };

        expect(readDiscordBindings(config).map((binding) => binding.id)).toEqual([
            'discord:shared:main:0',
            'discord:shared:main:1',
        ]);
        expect(deleteDiscordBindingConfig(config, 'discord:shared:main:1', {}).bindings).toEqual([
            config.bindings[0],
        ]);
    });

    test('excludes Discord ACP bindings from settings mutations', () => {
        const config = {
            bindings: [
                {
                    acp: {
                        backend: 'codex',
                        mode: 'persistent',
                    },
                    agentId: 'main',
                    match: {
                        accountId: 'main',
                        channel: 'discord',
                    },
                    type: 'acp',
                },
            ],
            channels: {
                discord: {
                    accounts: {
                        main: {
                            name: 'Main Discord',
                            token: 'secret',
                        },
                    },
                },
            },
        };

        expect(readDiscordBindings(config)).toEqual([]);
        expect(deleteDiscordBindingConfig(config, 'discord:main:main:0', {})).toEqual(config);
    });

    test('queues concurrent config mutations on fresh config hashes', async () => {
        const appliedBaseHashes: string[] = [];
        const client = createConfigClient({
            agents: {
                list: [{ id: 'main', name: 'main' }],
            },
        });
        client.onApply((baseHash) => {
            appliedBaseHashes.push(baseHash);
        });

        const nameMutation = applyOpenClawConfigMutation(client, {
            update: (config) =>
                updateAgentNameConfig(config, 'main', {
                    name: 'Blippy',
                }),
        });
        const thinkingMutation = applyOpenClawConfigMutation(client, {
            update: (config) =>
                updateAgentThinkingDefaultConfig(config, 'main', {
                    thinkingDefault: 'high',
                }),
        });

        await Promise.all([nameMutation, thinkingMutation]);

        expect(appliedBaseHashes).toEqual(['0', '1']);
        expect(client.config).toEqual({
            agents: {
                list: [{ id: 'main', name: 'Blippy', thinkingDefault: 'high' }],
            },
        });
    });

    test('recovers the config snapshot when config.apply closes the Gateway after saving', async () => {
        const client = createConfigClient({
            agents: {
                list: [{ id: 'main', name: 'main' }],
            },
        });
        client.failNextApplyWithGatewayClose();

        const snapshot = await applyOpenClawConfigMutation(client, {
            update: (config) =>
                updateAgentNameConfig(config, 'main', {
                    name: 'Blippy',
                }),
        });

        expect(snapshot.config).toEqual({
            agents: {
                list: [{ id: 'main', name: 'Blippy' }],
            },
        });
    });
});

function createConfigClient(initialConfig: Record<string, unknown>) {
    let version = 0;
    let failNextApply = false;
    let onApply: ((baseHash: string) => void) | null = null;
    const client = {
        config: initialConfig,
        failNextApplyWithGatewayClose() {
            failNextApply = true;
        },
        async getOpenClawConfig() {
            return snapshot(String(version), client.config);
        },
        onApply(callback: (baseHash: string) => void) {
            onApply = callback;
        },
        async applyOpenClawConfig(input: { baseHash: string; config: Record<string, unknown> }) {
            onApply?.(input.baseHash);
            client.config = input.config;
            version += 1;

            if (failNextApply) {
                failNextApply = false;
                throw Object.assign(new Error('OpenClaw Gateway connection closed.'), {
                    code: 'openclaw_gateway_closed',
                });
            }

            return snapshot(String(version), client.config);
        },
    };

    return client;
}

function snapshot(hash: string, config: Record<string, unknown>) {
    return {
        config,
        hash,
        issues: [],
        raw: JSON.stringify(config),
        valid: true,
    };
}
