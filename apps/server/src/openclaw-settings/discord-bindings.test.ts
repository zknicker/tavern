import { expect, test } from 'bun:test';

import { readOpenClawDiscordBindings } from './discord-bindings.ts';

test('readOpenClawDiscordBindings preserves implicit default Discord account routes', () => {
    expect(
        readOpenClawDiscordBindings({
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
        })
    ).toEqual([
        expect.objectContaining({
            accountId: 'default',
            agentId: 'main',
            id: 'discord:default:main:0',
            name: 'Default Discord',
            platform: 'discord',
        }),
    ]);
});

test('readOpenClawDiscordBindings excludes Discord ACP bindings', () => {
    expect(
        readOpenClawDiscordBindings({
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
        })
    ).toEqual([]);
});
