import { expect, test } from 'vitest';
import { validateOpenClawConfigDraft } from './openclaw-config-validation.ts';

test('validateOpenClawConfigDraft accepts Discord route bindings from the settings draft', () => {
    expect(
        validateOpenClawConfigDraft({
            bindings: [
                {
                    agentId: 'main',
                    match: {
                        accountId: 'default',
                        channel: 'discord',
                    },
                },
            ],
            channels: {
                discord: {
                    accounts: {
                        default: {
                            allowBots: 'mentions',
                            enabled: true,
                            groupPolicy: 'open',
                            guilds: {
                                '1090835947375054888': {
                                    channels: {},
                                    ignoreOtherMentions: true,
                                    requireMention: true,
                                },
                            },
                            name: 'Mr Agent',
                            replyToMode: 'off',
                            token: 'discord-token',
                        },
                    },
                },
            },
        })
    ).toBeNull();
});

test('validateOpenClawConfigDraft rejects fields outside the OpenClaw binding schema', () => {
    const message = validateOpenClawConfigDraft({
        bindings: [
            {
                agentId: 'main',
                inboundMode: 'active',
                match: {
                    accountId: 'default',
                    channel: 'discord',
                },
            },
        ],
    });

    expect(message).toBe('Invalid OpenClaw settings at bindings.0: Invalid input');
});
