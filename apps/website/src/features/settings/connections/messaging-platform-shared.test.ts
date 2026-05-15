import { expect, test } from 'vitest';
import {
    buildDiscordBindingName,
    buildDiscordBindingSaveInput,
} from './messaging-platform-shared.ts';

const agentOptions = [
    {
        avatar: 'A',
        color: '#64748b',
        idLabel: 'atlas',
        summary: 'Workspace atlas',
        title: 'Atlas',
        value: 'atlas',
    },
];

test('buildDiscordBindingName prefers the selected agent title', () => {
    expect(buildDiscordBindingName(agentOptions, 'atlas')).toBe('Atlas');
    expect(buildDiscordBindingName(agentOptions, 'ops')).toBe('ops');
});

test('buildDiscordBindingSaveInput derives the binding name and strips resolved Discord metadata', () => {
    expect(
        buildDiscordBindingSaveInput(
            {
                accountId: 'primary',
                allowBots: 'mentions',
                agentId: 'atlas',
                dmUserIds: 'user-1',
                enabled: true,
                groupPolicy: 'allowlist',
                guilds: [
                    {
                        channelIds: ['channel-1', ' channel-2 ', ''],
                        id: 'guild-1',
                        ignoreOtherMentions: true,
                        requireMention: true,
                    },
                ],
                id: 'discord:atlas',
                inboundMode: 'mention-only',
                mentionPatterns: '@atlas, atlas',
                metadata: {
                    clientId: 'app-1',
                    publicKey: 'public-key-1',
                },
                parentChannelIds: '',
                replyToMode: 'first',
                token: ' discord-token ',
                tokenConfigured: false,
                tokenSource: 'missing',
            },
            agentOptions
        )
    ).toEqual({
        accountId: 'primary',
        allowBots: 'mentions',
        agentId: 'atlas',
        enabled: true,
        groupPolicy: 'allowlist',
        guilds: [
            {
                channelIds: ['channel-1', 'channel-2'],
                id: 'guild-1',
                ignoreOtherMentions: true,
                requireMention: true,
            },
        ],
        id: 'discord:atlas',
        inboundMode: 'mention-only',
        match: {
            dmUserIds: ['user-1'],
            parentChannelIds: [],
        },
        mentionPatterns: ['@atlas', 'atlas'],
        metadata: {},
        name: 'Atlas',
        platform: 'discord',
        replyToMode: 'first',
        token: 'discord-token',
    });
});

test('buildDiscordBindingSaveInput preserves existing tokens when no replacement is entered', () => {
    expect(
        buildDiscordBindingSaveInput(
            {
                accountId: 'primary',
                allowBots: false,
                agentId: 'atlas',
                dmUserIds: '',
                enabled: true,
                groupPolicy: 'allowlist',
                guilds: [],
                id: 'discord:atlas',
                inboundMode: 'active',
                mentionPatterns: '',
                metadata: {},
                parentChannelIds: '',
                replyToMode: 'off',
                token: '',
                tokenConfigured: true,
                tokenSource: 'redacted',
            },
            agentOptions
        ).token
    ).toBeNull();
});
