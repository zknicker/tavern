import crypto from 'node:crypto';

const zeroCost = Object.freeze({
    cacheRead: 0,
    cacheWrite: 0,
    input: 0,
    output: 0,
});

const noBundledSkillAllowlist = ['__tavern_no_bundled_openclaw_skills__'];

const e2eAgentToolNames = [
    'read',
    'write',
    'edit',
    'apply_patch',
    'exec',
    'process',
    'web_search',
    'web_fetch',
    'memory_search',
    'memory_get',
    'sessions_list',
    'sessions_history',
    'sessions_send',
    'sessions_spawn',
    'subagents',
    'session_status',
    'cortex_search',
    'cortex_get_page',
    'cortex_capture',
    'cortex_recall',
    'cortex_list_backlinks',
];

interface OpenClawE2eConfigInput {
    cortexPluginPath: string;
    gatewayPort: number;
    gatewayToken: string;
    pluginPath: string;
    providerBaseUrl: string;
    workspaceDir: string;
    workspacePluginPath: string;
}

export function buildOpenClawE2eConfig(input: OpenClawE2eConfigInput) {
    const primaryModel = 'mock-openai/gpt-5.5';
    const alternateModel = 'mock-openai/gpt-5.5-alt';

    return {
        agents: {
            defaults: {
                memorySearch: {
                    sync: {
                        onSearch: false,
                        onSessionStart: false,
                        watch: false,
                    },
                },
                model: {
                    primary: primaryModel,
                },
                models: {
                    [alternateModel]: {
                        params: {
                            openaiWsWarmup: false,
                            transport: 'sse',
                        },
                    },
                    [primaryModel]: {
                        params: {
                            openaiWsWarmup: false,
                            transport: 'sse',
                        },
                    },
                },
                sandbox: buildTavernDefaultSandbox(),
                workspace: input.workspaceDir,
            },
            list: [
                {
                    default: true,
                    id: 'planner',
                    identity: {
                        name: 'Planner',
                    },
                    model: {
                        primary: primaryModel,
                    },
                    sandbox: buildTavernSandbox({
                        agentId: 'planner',
                        workspaceDir: input.workspaceDir,
                    }),
                    tools: {
                        allow: e2eAgentToolNames,
                        profile: 'coding',
                    },
                },
            ],
        },
        channels: {
            tavern: {},
        },
        discovery: {
            mdns: {
                mode: 'off',
            },
        },
        gateway: {
            auth: {
                mode: 'token',
                token: input.gatewayToken,
            },
            bind: 'loopback',
            controlUi: {
                enabled: false,
            },
            mode: 'local',
            port: input.gatewayPort,
            reload: {
                deferralTimeoutMs: 1000,
            },
        },
        models: {
            mode: 'replace',
            providers: createMockProviderMap(input.providerBaseUrl),
        },
        plugins: {
            allow: ['tavern', 'tavern-cortex', 'tavern-workspace'],
            bundledDiscovery: 'allowlist',
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
            },
            load: {
                paths: [input.pluginPath, input.cortexPluginPath, input.workspacePluginPath],
            },
            slots: {
                memory: 'none',
            },
        },
        skills: {
            allowBundled: noBundledSkillAllowlist,
        },
        tools: {
            profile: 'coding',
        },
    };
}

function buildTavernSandbox(input: { agentId?: string; workspaceDir: string }) {
    const docker: Record<string, unknown> = {
        containerPrefix: buildSandboxContainerPrefix(input),
        image: 'openclaw-sandbox-common:bookworm-slim',
    };
    if (input.agentId) {
        docker.env = {};
    }

    return {
        backend: 'docker',
        docker,
        mode: 'all',
        scope: 'agent',
        workspaceAccess: 'rw',
    };
}

function buildTavernDefaultSandbox() {
    return {
        backend: 'docker',
        docker: {
            image: 'openclaw-sandbox-common:bookworm-slim',
        },
        mode: 'all',
        scope: 'agent',
        workspaceAccess: 'rw',
    };
}

function buildSandboxContainerPrefix(input: { agentId?: string; workspaceDir: string }) {
    const workspaceHash = crypto
        .createHash('sha256')
        .update(input.workspaceDir)
        .digest('hex')
        .slice(0, 10);
    const agentId = (input.agentId ?? 'default')
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/g, '-')
        .slice(0, 24);

    return `tavern-e2e-${agentId}-${workspaceHash}-`;
}

function createMockProviderMap(providerBaseUrl: string) {
    const openAiProvider = {
        api: 'openai-responses',
        apiKey: 'test',
        baseUrl: providerBaseUrl,
        models: [
            createMockOpenAiModel('gpt-5.5'),
            createMockOpenAiModel('gpt-5.5-alt'),
            createMockOpenAiModel('gpt-image-1'),
        ],
        request: {
            allowPrivateNetwork: true,
        },
    };

    return {
        'mock-openai': openAiProvider,
        anthropic: {
            api: 'anthropic-messages',
            apiKey: 'test',
            baseUrl: trimTrailingApiV1(providerBaseUrl),
            models: [
                createMockAnthropicModel('claude-opus-4-6'),
                createMockAnthropicModel('claude-sonnet-4-6'),
            ],
            request: {
                allowPrivateNetwork: true,
            },
        },
        openai: {
            ...openAiProvider,
            models: openAiProvider.models.map((model) => ({ ...model })),
        },
    };
}

function createMockOpenAiModel(id: string) {
    return {
        api: 'openai-responses',
        contextWindow: 128_000,
        cost: zeroCost,
        id,
        input: ['text', 'image'],
        maxTokens: 4096,
        name: id,
        reasoning: false,
    };
}

function createMockAnthropicModel(id: string) {
    return {
        api: 'anthropic-messages',
        contextWindow: 200_000,
        cost: zeroCost,
        id,
        input: ['text', 'image'],
        maxTokens: 4096,
        name: id,
        reasoning: false,
    };
}

function trimTrailingApiV1(baseUrl: string) {
    return baseUrl.replace(/\/v1\/?$/i, '');
}
