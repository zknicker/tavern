import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { OPENCLAW_RUN_ROOT, readConfigValue } from '../config';
import { mergeManagedOpenClawConfig } from './config-merge';
import { createMockProviderMap } from './mock-provider-config';
import {
    applyManagedOpenClawPluginInstallSpecs,
    type ManagedOpenClawPluginInstallSpec,
    resolveManagedOpenClawPluginInstallSpecs,
} from './plugin-installs';
import { resolveTavernMessengerPluginPath } from './tavern-messenger-plugin';
import { resolveManagedOpenClawVersion } from './version';

export interface ManagedOpenClawRuntimeConfig {
    configDir: string;
    configPath: string;
    gatewayPort: number;
    gatewayToken: string;
    gatewayUrl: string;
    pluginInstallSpecs: ManagedOpenClawPluginInstallSpec[];
    pluginPath: string | null;
    stateDir: string;
    workspaceDir: string;
}

export async function prepareManagedOpenClawConfig(input?: {
    codexPluginRoot?: string;
    openClawInstallRoot?: string;
    openClawPackageRoot?: string;
}): Promise<ManagedOpenClawRuntimeConfig> {
    const gatewayPort = Number.parseInt(
        readConfigValue('TAVERN_OPENCLAW_GATEWAY_PORT') ?? '18789',
        10
    );
    const gatewayToken = readConfigValue('OPENCLAW_GATEWAY_TOKEN') ?? createGatewayToken();
    const stateDir = path.join(OPENCLAW_RUN_ROOT, 'state');
    const workspaceDir = path.join(OPENCLAW_RUN_ROOT, 'workspace');
    const configDir = OPENCLAW_RUN_ROOT;
    const configPath = path.join(OPENCLAW_RUN_ROOT, 'openclaw.json');
    const pluginPath = await resolveTavernMessengerPluginPath(input?.openClawPackageRoot);
    const existingConfig = await readExistingOpenClawConfig(configPath);
    const version = resolveManagedOpenClawVersion();
    const managedConfig = buildManagedOpenClawConfig({
        existingConfig,
        gatewayPort,
        gatewayToken,
        codexPluginRoot: input?.codexPluginRoot ?? null,
        openClawInstallRoot: input?.openClawInstallRoot ?? null,
        pluginPath,
        version,
        workspaceDir,
    });
    const pluginInstallSpecs = [
        ...resolveManagedOpenClawPluginInstallSpecs({
            config: existingConfig ?? {},
            installRoot: input?.openClawInstallRoot,
            version,
        }),
        ...resolveManagedOpenClawPluginInstallSpecs({
            config: managedConfig,
            installRoot: input?.openClawInstallRoot,
            version,
        }),
    ];

    await fs.mkdir(stateDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(configPath, `${JSON.stringify(managedConfig, null, 2)}\n`, { mode: 0o600 });

    return {
        configDir,
        configPath,
        gatewayPort,
        gatewayToken,
        gatewayUrl: `ws://127.0.0.1:${gatewayPort}`,
        pluginInstallSpecs: dedupePluginInstallSpecs(pluginInstallSpecs),
        pluginPath,
        stateDir,
        workspaceDir,
    };
}

export function buildManagedOpenClawConfig(input: {
    codexPluginRoot?: string | null;
    existingConfig?: Record<string, unknown> | null;
    gatewayPort: number;
    gatewayToken: string;
    openClawInstallRoot?: string | null;
    pluginPath: string | null;
    version: string;
    workspaceDir: string;
}) {
    const pluginPaths = [input.pluginPath, input.codexPluginRoot].filter(
        (pluginPath): pluginPath is string =>
            typeof pluginPath === 'string' && pluginPath.length > 0
    );
    const mockProviderBaseUrl = resolveMockProviderBaseUrl();
    const primaryModel = mockProviderBaseUrl ? 'mock-openai/gpt-5.5' : 'openai/gpt-5.5';
    const modelConfig = mockProviderBaseUrl
        ? {
              params: {
                  openaiWsWarmup: false,
                  transport: 'sse',
              },
          }
        : {
              agentRuntime: {
                  id: 'codex',
              },
          };

    const managedConfig = {
        agents: {
            defaults: {
                maxConcurrent: 4,
                model: mockProviderBaseUrl ? { primary: primaryModel } : primaryModel,
                models: {
                    [primaryModel]: modelConfig,
                },
                sandbox: {
                    backend: 'none',
                    mode: 'off',
                },
                subagents: {
                    maxConcurrent: 8,
                },
                workspace: input.workspaceDir,
            },
            list: [
                {
                    id: 'main',
                    model: {
                        fallbacks: [],
                        primary: primaryModel,
                    },
                    models: {
                        [primaryModel]: modelConfig,
                    },
                    name: 'main',
                    tools: {
                        allow: defaultAgentToolNames,
                        deny: [],
                        profile: 'full',
                    },
                },
            ],
        },
        channels: {
            tavern: {},
        },
        commands: {
            native: 'auto',
            nativeSkills: 'auto',
            ownerDisplay: 'raw',
            restart: true,
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
        },
        memory: {
            backend: 'builtin',
        },
        ...(mockProviderBaseUrl
            ? {
                  models: {
                      mode: 'replace',
                      providers: createMockProviderMap(mockProviderBaseUrl),
                  },
              }
            : {}),
        meta: {
            lastTouchedAt: new Date().toISOString(),
            lastTouchedVersion: input.version,
        },
        messages: {
            ackReactionScope: 'group-mentions',
            groupChat: {
                visibleReplies: 'message_tool',
            },
        },
        plugins: {
            allow: ['tavern', 'codex', 'memory-core', 'openai'],
            bundledDiscovery: 'allowlist',
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
                paths: pluginPaths,
            },
        },
        tools: {
            profile: 'coding',
        },
    };

    const mergedConfig = mergeManagedOpenClawConfig(managedConfig, input.existingConfig);
    return applyManagedOpenClawPluginInstallSpecs(
        mergedConfig,
        resolveManagedOpenClawPluginInstallSpecs({
            config: mergedConfig,
            installRoot: input.openClawInstallRoot,
            version: input.version,
        })
    );
}

async function readExistingOpenClawConfig(configPath: string) {
    try {
        return JSON.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function dedupePluginInstallSpecs(specs: ManagedOpenClawPluginInstallSpec[]) {
    return Array.from(new Map(specs.map((spec) => [spec.pluginId, spec])).values());
}

function resolveMockProviderBaseUrl() {
    const port = readConfigValue('TAVERN_MOCK_PROVIDER_PORT');
    return port ? `http://127.0.0.1:${port}/v1` : null;
}

const defaultAgentToolNames = [
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
];

function createGatewayToken() {
    return `tavern-${crypto.randomBytes(24).toString('base64url')}`;
}
