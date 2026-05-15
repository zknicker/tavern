import { expect, test } from 'vitest';
import {
    deleteDiscordBinding,
    readDiscordBindings,
    upsertDiscordBinding,
} from './messaging-platform-draft.ts';

const config = {
    bindings: [
        {
            agentId: 'main',
            match: {
                accountId: 'default',
                channel: 'discord',
            },
        },
        {
            agentId: 'tiny',
            match: {
                accountId: 'tiny',
                channel: 'discord',
            },
        },
    ],
    agents: {
        list: [
            {
                groupChat: {
                    mentionPatterns: ['@main'],
                },
                id: 'main',
            },
        ],
    },
    channels: {
        discord: {
            accounts: {
                default: {
                    allowBots: true,
                    guilds: {
                        'guild-1': {
                            channels: {
                                'channel-1': {
                                    enabled: true,
                                    requireMention: true,
                                },
                            },
                            requireMention: true,
                        },
                    },
                    name: 'TheClaw',
                    token: 'default-token',
                },
                tiny: {
                    enabled: true,
                    guilds: {},
                    name: 'Tiny',
                    token: 'tiny-token',
                },
            },
        },
    },
};

test('readDiscordBindings projects OpenClaw config accounts as configured Discord bindings', () => {
    expect(readDiscordBindings(config)).toEqual([
        expect.objectContaining({
            accountId: 'default',
            allowBots: true,
            agentId: 'main',
            groupPolicy: 'allowlist',
            guilds: [
                {
                    channelIds: ['channel-1'],
                    id: 'guild-1',
                    ignoreOtherMentions: true,
                    requireMention: true,
                },
            ],
            id: 'discord:default:main:0',
            inboundMode: 'mention-only',
            match: expect.objectContaining({
                channelIds: ['channel-1'],
                guildIds: ['guild-1'],
            }),
            metadata: {
                allowBots: true,
            },
            mentionPatterns: ['@main'],
            name: 'TheClaw',
            replyToMode: 'off',
            status: 'configured',
            tokenConfigured: true,
            tokenSource: 'plaintext',
        }),
        expect.objectContaining({
            accountId: 'tiny',
            agentId: 'tiny',
            id: 'discord:tiny:tiny:1',
            inboundMode: 'active',
            name: 'Tiny',
            status: 'configured',
            tokenConfigured: true,
            tokenSource: 'plaintext',
        }),
    ]);
});

test('upsertDiscordBinding updates the binding and account inside the config draft', () => {
    const next = upsertDiscordBinding(config, {
        accountId: 'default',
        allowBots: false,
        agentId: 'main',
        enabled: true,
        groupPolicy: 'allowlist',
        guilds: [
            {
                channelIds: ['channel-2'],
                id: 'guild-1',
                ignoreOtherMentions: true,
                requireMention: false,
            },
        ],
        id: 'discord:default:main:0',
        inboundMode: 'active',
        match: {
            dmUserIds: [],
            parentChannelIds: [],
        },
        mentionPatterns: ['@main', 'main'],
        metadata: {},
        name: 'Main',
        platform: 'discord',
        replyToMode: 'first',
        token: 'new-token',
    });

    expect(next).toMatchObject({
        bindings: [
            {
                agentId: 'main',
                match: {
                    accountId: 'default',
                    channel: 'discord',
                },
            },
            config.bindings[1],
        ],
        channels: {
            discord: {
                accounts: {
                    default: {
                        enabled: true,
                        groupPolicy: 'allowlist',
                        guilds: {
                            'guild-1': {
                                channels: {
                                    'channel-2': {
                                        enabled: true,
                                        requireMention: false,
                                    },
                                },
                                ignoreOtherMentions: true,
                                requireMention: false,
                            },
                        },
                        name: 'Main',
                        replyToMode: 'first',
                        token: 'new-token',
                    },
                },
            },
        },
        agents: {
            list: [
                {
                    groupChat: {
                        mentionPatterns: ['@main', 'main'],
                    },
                    id: 'main',
                },
            ],
        },
    });
    const nextBindings = next.bindings as Record<string, unknown>[];
    expect(nextBindings[0]).not.toHaveProperty('inboundMode');
});

test('upsertDiscordBinding persists the bot message policy', () => {
    const next = upsertDiscordBinding(config, {
        accountId: 'default',
        allowBots: 'mentions',
        agentId: 'main',
        enabled: true,
        groupPolicy: 'allowlist',
        guilds: [],
        id: 'discord:default:main:0',
        inboundMode: 'active',
        match: {
            dmUserIds: [],
            parentChannelIds: [],
        },
        mentionPatterns: [],
        metadata: {},
        name: 'Main',
        platform: 'discord',
        replyToMode: 'off',
        token: 'new-token',
    });

    expect((next.channels as typeof config.channels).discord.accounts.default.allowBots).toBe(
        'mentions'
    );
});

test('upsertDiscordBinding preserves existing token when no replacement is entered', () => {
    const next = upsertDiscordBinding(config, {
        accountId: 'default',
        allowBots: false,
        agentId: 'main',
        enabled: true,
        groupPolicy: 'allowlist',
        guilds: [],
        id: 'discord:default:main:0',
        inboundMode: 'active',
        match: {
            dmUserIds: [],
            parentChannelIds: [],
        },
        mentionPatterns: [],
        metadata: {},
        name: 'Main',
        platform: 'discord',
        replyToMode: 'off',
        token: null,
    });

    expect((next.channels as typeof config.channels).discord.accounts.default.token).toBe(
        'default-token'
    );
});

test('readDiscordBindings treats redacted and SecretRef tokens as configured', () => {
    expect(
        readDiscordBindings({
            bindings: [
                {
                    agentId: 'redacted',
                    match: {
                        accountId: 'redacted',
                        channel: 'discord',
                    },
                },
                {
                    agentId: 'secret-ref',
                    match: {
                        accountId: 'secret-ref',
                        channel: 'discord',
                    },
                },
            ],
            channels: {
                discord: {
                    accounts: {
                        redacted: {
                            token: '__OPENCLAW_REDACTED__',
                        },
                        'secret-ref': {
                            token: {
                                id: 'DISCORD_BOT_TOKEN',
                                provider: 'env',
                                source: 'env',
                            },
                        },
                    },
                },
            },
        })
    ).toEqual([
        expect.objectContaining({
            tokenConfigured: true,
            tokenSource: 'redacted',
        }),
        expect.objectContaining({
            tokenConfigured: true,
            tokenSource: 'secret-ref',
        }),
    ]);
});

test('deleteDiscordBinding removes the config binding and unreferenced account', () => {
    const next = deleteDiscordBinding(config, 'discord:tiny:tiny:1');
    const accounts = (next.channels as typeof config.channels).discord.accounts;

    expect(next.bindings).toEqual([config.bindings[0]]);
    expect(next.channels).toMatchObject({
        discord: {
            accounts: {
                default: expect.any(Object),
            },
        },
    });
    expect(Object.keys(accounts)).toEqual(['default']);
});
