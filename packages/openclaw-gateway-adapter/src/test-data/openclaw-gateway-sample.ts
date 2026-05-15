// Generated from a sanitized OpenClaw Gateway capture.
export const openClawGatewaySample = {
    status: {
        health: {
            ok: true,
            ts: 1_777_831_592_669,
            plugins: {
                loaded: ['discord', 'codex'],
                errors: [],
            },
            channels: {
                discord: {
                    accounts: {
                        default: {
                            accountId: 'default',
                            name: 'TheClaw',
                            enabled: true,
                            configured: true,
                            running: true,
                            connected: true,
                            bot: {
                                id: '1458207731562446868',
                                username: 'TheClaw',
                            },
                        },
                        blippy: {
                            accountId: 'blippy',
                            name: 'Blippy',
                            enabled: true,
                            configured: true,
                            running: true,
                            connected: true,
                            bot: {
                                id: '1493455358532911305',
                                username: 'Blippy',
                            },
                        },
                    },
                },
            },
            defaultAgentId: 'main',
            agents: [
                {
                    agentId: 'main',
                    name: 'main',
                    isDefault: true,
                },
                {
                    agentId: 'blippy',
                    name: 'Blippy',
                    isDefault: false,
                },
            ],
        },
        status: {
            runtimeVersion: '2026.5.2',
            heartbeat: {
                enabled: true,
            },
            channelSummary: [
                {
                    channel: 'discord',
                    accountId: 'default',
                    connected: true,
                },
            ],
            queuedSystemEvents: [],
            tasks: [],
            taskAudit: [],
            sessions: {
                count: 2,
            },
        },
    },
    agents: {
        defaultId: 'main',
        mainKey: 'main',
        scope: 'global',
        agents: [
            {
                id: 'main',
                name: 'main',
                isDefault: true,
                workspace: '/openclaw/workspace/theclaw',
                skills: ['todo'],
            },
            {
                id: 'blippy',
                name: 'Blippy',
                isDefault: false,
                workspace: '/openclaw/workspace/blippy',
                skills: [],
            },
        ],
    },
    agentFilesList: {
        agentId: 'main',
        workspace: '/openclaw/workspace/theclaw',
        files: [
            {
                name: 'AGENTS.md',
                path: '/openclaw/workspace/theclaw/AGENTS.md',
                missing: false,
                size: 3089,
                updatedAt: 1_777_810_000_000,
            },
            {
                name: 'SOUL.md',
                path: '/openclaw/workspace/theclaw/SOUL.md',
                missing: false,
                size: 1200,
                updatedAt: 1_777_810_000_000,
            },
        ],
    },
    agentFileGet: {
        agentId: 'main',
        workspace: '/openclaw/workspace/theclaw',
        file: {
            name: 'AGENTS.md',
            path: '/openclaw/workspace/theclaw/AGENTS.md',
            missing: false,
            size: 42,
            updatedAt: 1_777_810_000_000,
            content: '# Agent Instructions\nUse gateway samples.\n',
        },
    },
    sessions: {
        ts: 1_777_831_592_669,
        path: '/openclaw/agents/main/sessions/sessions.json',
        count: 5,
        defaults: {
            agentId: 'main',
        },
        sessions: [
            {
                key: 'agent:main:discord:channel:1090835947375054891',
                sessionId: 'main-channel-session',
                kind: 'group',
                displayName: 'discord:1090835947375054888#general',
                lastChannel: 'discord',
                lastTo: 'channel:1090835947375054891',
                origin: {
                    label: '#general channel id:1090835947375054891',
                    provider: 'discord',
                    surface: 'discord',
                    chatType: 'channel',
                    from: 'discord:channel:1090835947375054891',
                    to: 'channel:1090835947375054891',
                    accountId: 'default',
                },
                deliveryContext: {
                    channel: 'discord',
                    to: 'channel:1090835947375054891',
                    accountId: 'default',
                },
                updatedAt: 1_777_692_556_321,
                messageCount: 12,
            },
            {
                key: 'agent:tiny:discord:channel:1090835947375054891',
                sessionId: 'tiny-channel-session',
                kind: 'group',
                displayName: 'discord:1090835947375054888#general',
                lastChannel: 'discord',
                lastTo: 'channel:1090835947375054891',
                origin: {
                    label: '#general channel id:1090835947375054891',
                    provider: 'discord',
                    surface: 'discord',
                    chatType: 'channel',
                    from: 'discord:channel:1090835947375054891',
                    to: 'channel:1090835947375054891',
                    accountId: 'tiny',
                },
                deliveryContext: {
                    channel: 'discord',
                    to: 'channel:1090835947375054891',
                    accountId: 'tiny',
                },
                updatedAt: 1_777_669_985_792,
                messageCount: 8,
            },
            {
                key: 'agent:blippy:main',
                sessionId: 'blippy-dm-session',
                kind: 'direct',
                displayName: 'example user id:100000000000000001',
                lastChannel: 'discord',
                lastTo: 'user:100000000000000001',
                origin: {
                    label: 'example user id:100000000000000001',
                    provider: 'discord',
                    surface: 'discord',
                    chatType: 'direct',
                    from: 'discord:100000000000000001',
                    to: 'user:100000000000000001',
                    accountId: 'blippy',
                },
                deliveryContext: {
                    channel: 'discord',
                    to: 'user:100000000000000001',
                    accountId: 'blippy',
                },
                updatedAt: 1_777_754_902_769,
                messageCount: 4,
            },
            {
                key: 'agent:main:cron:1d7f8da1-0691-410c-a8d7-d260e829680a',
                sessionId: 'cron-list-session',
                kind: 'direct',
                displayName: 'Cron: Reminder Poller',
                updatedAt: 1_777_824_000_428,
                messageCount: 6,
            },
            {
                key: 'agent:main:subagent:62d63671-c8d7-482b-a36f-1928780bfacf',
                sessionId: 'subagent-session',
                displayName: 'discord:1090835947375054888#general',
                spawnedBy: 'agent:main:discord:channel:1090835947375054891',
                lastChannel: 'discord',
                updatedAt: 1_775_444_322_970,
                messageCount: 2,
            },
        ],
    },
    chatHistory: {
        dm: {
            sessionKey: 'agent:blippy:main',
            sessionId: 'dm-session',
            messages: [
                {
                    role: 'user',
                    content: 'Hello agent!',
                    timestamp: 1_777_754_727_254,
                    idempotencyKey: 'client:user:0',
                    __openclaw: {
                        id: '5b2e44f9-b3dc-42e0-9a81-cd9e98338d85',
                        seq: 1,
                    },
                    senderLabel: 'Example User (100000000000000001)',
                },
                {
                    role: 'assistant',
                    content: [
                        {
                            type: 'text',
                            text: 'Assistant reply.',
                        },
                    ],
                    api: 'openai-responses',
                    provider: 'openai',
                    model: 'gpt-5.5',
                    usage: {
                        input: 29_824,
                        output: 28,
                        totalTokens: 32_284,
                        cacheRead: 2432,
                        cacheWrite: 0,
                    },
                    stopReason: 'stop',
                    timestamp: 1_777_754_727_254,
                    idempotencyKey: 'client:assistant:1',
                    __openclaw: {
                        id: '26018285-6404-4099-8b40-8b4f01beddb1',
                        seq: 2,
                    },
                },
            ],
        },
        cron: {
            sessionKey: 'agent:main:cron:1d7f8da1-0691-410c-a8d7-d260e829680a',
            sessionId: 'cron-session',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '[cron:1d7f8da1 Reminder Poller] Run the reminder poller.',
                        },
                    ],
                    timestamp: 1_777_830_003_526,
                    __openclaw: {
                        id: 'b24f09cb',
                        seq: 1,
                    },
                },
            ],
        },
        channel: {
            sessionKey: 'agent:main:discord:channel:1090835947375054891',
            sessionId: 'channel-session',
            messages: [
                {
                    role: 'user',
                    content: 'Hello channel agent!',
                    timestamp: 1_777_692_500_000,
                    __openclaw: {
                        id: 'channel-message-1',
                        seq: 1,
                    },
                    senderLabel: 'Example User (100000000000000001)',
                },
                {
                    role: 'assistant',
                    content: [
                        {
                            type: 'text',
                            text: 'Channel response.',
                        },
                        {
                            type: 'image',
                            mimeType: 'image/png',
                            name: 'chart.png',
                            reference: {
                                path: '/openclaw/workspace/theclaw/chart.png',
                                uri: 'file:///openclaw/workspace/theclaw/chart.png',
                            },
                            sizeBytes: 8000,
                        },
                    ],
                    api: 'openai-responses',
                    provider: 'openai',
                    model: 'gpt-5.5',
                    timestamp: 1_777_692_505_000,
                    __openclaw: {
                        id: 'channel-message-2',
                        seq: 2,
                    },
                },
            ],
        },
    },
    cron: {
        jobs: [
            {
                id: 'd3292360-3ce0-4331-a917-e7eaba948886',
                agentId: 'tiny',
                name: 'Daily Check-In',
                enabled: true,
                createdAtMs: 1_770_322_500_377,
                schedule: {
                    kind: 'cron',
                    expr: '0 9 * * *',
                    tz: 'America/New_York',
                },
                sessionTarget: 'isolated',
                wakeMode: 'next-heartbeat',
                payload: {
                    kind: 'agentTurn',
                    message: 'Run the daily check-in.',
                    timeoutSeconds: 120,
                },
                delivery: {
                    mode: 'announce',
                    channel: 'discord',
                    to: 'channel:1458323781125668958',
                },
                state: {
                    nextRunAtMs: 1_777_899_600_000,
                    lastRunAtMs: 1_777_813_200_013,
                    lastStatus: 'ok',
                    lastDurationMs: 21_649,
                    consecutiveErrors: 0,
                    lastRunStatus: 'ok',
                    lastDeliveryStatus: 'delivered',
                    lastDelivered: true,
                },
                updatedAtMs: 1_777_813_221_662,
            },
        ],
        total: 1,
        offset: 0,
        limit: 1,
        hasMore: false,
        nextOffset: null,
    },
    cronRuns: {
        entries: [
            {
                ts: 1_777_813_237_533,
                jobId: 'd3292360-3ce0-4331-a917-e7eaba948886',
                action: 'finished',
                status: 'ok',
                summary: 'Daily check-in complete.',
                runAtMs: 1_777_813_200_013,
                durationMs: 21_649,
                nextRunAtMs: 1_777_899_600_000,
                model: 'gpt-5.5',
                provider: 'openai',
                usage: {
                    input_tokens: 15_511,
                    output_tokens: 179,
                    total_tokens: 14_621,
                },
                delivered: true,
                deliveryStatus: 'delivered',
                sessionId: '39e6406f-9730-43d5-8973-0f575f36dbc4',
                sessionKey:
                    'agent:tiny:cron:d3292360-3ce0-4331-a917-e7eaba948886:run:39e6406f-9730-43d5-8973-0f575f36dbc4',
            },
        ],
        total: 1,
        offset: 0,
        limit: 50,
        hasMore: false,
        nextOffset: null,
    },
    models: {
        models: [
            {
                id: 'openai/gpt-5.5',
                provider: 'openai',
                label: 'GPT-5.5',
            },
            {
                id: 'anthropic/claude-4.5-sonnet',
                provider: 'anthropic',
                label: 'Claude Sonnet',
            },
        ],
    },
    skills: {
        workspaceDir: '/openclaw/workspace/theclaw',
        managedSkillsDir: '/openclaw/skills',
        skills: [
            {
                name: '1password',
                slug: '1password',
                description: 'Use 1Password CLI.',
                source: 'openclaw-bundled',
                updatedAt: 1_777_000_000_000,
                allowedTools: 'terminal',
            },
            {
                name: 'todo',
                slug: 'todo',
                description: 'Manage reminders.',
                source: 'installed',
                updatedAt: 1_777_000_000_000,
                allowedTools: 'read,write',
            },
        ],
    },
    skillDetail: {
        skill: {
            name: '1password',
            slug: '1password',
            description: 'Use 1Password CLI.',
            source: 'openclaw-bundled',
            updatedAt: 1_777_000_000_000,
            allowedTools: 'terminal',
            contentMarkdown: '# 1Password\nUse the CLI.',
            files: [
                {
                    path: 'SKILL.md',
                    sizeBytes: 1234,
                },
            ],
        },
        latestVersion: null,
        metadata: {},
        owner: null,
        moderation: null,
    },
} as const;
