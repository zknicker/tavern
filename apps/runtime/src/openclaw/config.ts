import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OPENCLAW_RUN_ROOT, readConfigValue } from '../config';
import { getDb } from '../db/connection';
import { renderAgentInstructions, updateAgentInstructionSource } from '../workspace/instructions';
import { mergeManagedOpenClawConfig, stripRemovedManagedOpenClawPlugins } from './config-merge';
import { createMockProviderMap } from './mock-provider-config';
import {
    applyManagedOpenClawPluginInstallSpecs,
    type ManagedOpenClawPluginInstallSpec,
    resolveDefaultManagedOpenClawPluginInstallSpecs,
    resolveManagedOpenClawPluginInstallSpecs,
} from './plugin-installs';
import {
    resolveTavernCortexPluginPath,
    resolveTavernMessengerPluginPath,
    resolveTavernWorkspacePluginPath,
} from './tavern-messenger-plugin';
import { resolveManagedOpenClawVersion } from './version';

export interface ManagedOpenClawRuntimeConfig {
    configDir: string;
    configPath: string;
    gatewayPort: number;
    gatewayToken: string;
    gatewayUrl: string;
    pluginInstallSpecs: ManagedOpenClawPluginInstallSpec[];
    pluginPath: string | null;
    pluginPaths: string[];
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
    const cortexPluginPath = await resolveTavernCortexPluginPath(input?.openClawPackageRoot);
    const workspacePluginPath = await resolveTavernWorkspacePluginPath(input?.openClawPackageRoot);
    const existingConfig = stripRemovedManagedOpenClawPlugins(
        (await readExistingOpenClawConfig(configPath)) ?? {}
    );
    const version = resolveManagedOpenClawVersion();
    const codexAuthProfileId = await resolveManagedCodexAuthProfileId();
    const managedConfig = buildManagedOpenClawConfig({
        codexAuthProfileId,
        cortexPluginPath,
        existingConfig,
        gatewayPort,
        gatewayToken,
        codexPluginRoot: input?.codexPluginRoot ?? null,
        openClawInstallRoot: input?.openClawInstallRoot ?? null,
        pluginPath,
        version,
        workspacePluginPath,
        workspaceDir,
    });
    const pluginInstallSpecs = [
        ...resolveManagedOpenClawPluginInstallSpecs({
            config: existingConfig ?? {},
            installRoot: input?.openClawInstallRoot,
            version,
        }),
        ...resolveDefaultManagedOpenClawPluginInstallSpecs({
            installRoot: input?.openClawInstallRoot,
        }),
        ...resolveManagedOpenClawPluginInstallSpecs({
            config: managedConfig,
            installRoot: input?.openClawInstallRoot,
            version,
        }),
    ];

    await fs.mkdir(stateDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    updateAgentInstructionSource(getDb(), {
        agentId: 'main',
        agentName: 'main',
        workspaceDir,
    });
    await renderAgentInstructions(getDb(), 'main');
    await fs.writeFile(configPath, `${JSON.stringify(managedConfig, null, 2)}\n`, { mode: 0o600 });

    return {
        configDir,
        configPath,
        gatewayPort,
        gatewayToken,
        gatewayUrl: `ws://127.0.0.1:${gatewayPort}`,
        pluginInstallSpecs: dedupePluginInstallSpecs(pluginInstallSpecs),
        pluginPaths: [pluginPath, cortexPluginPath, workspacePluginPath].filter(
            (pluginPath): pluginPath is string =>
                typeof pluginPath === 'string' && pluginPath.length > 0
        ),
        pluginPath,
        stateDir,
        workspaceDir,
    };
}

export function buildManagedOpenClawConfig(input: {
    codexAuthProfileId?: string | null;
    codexPluginRoot?: string | null;
    cortexPluginPath?: string | null;
    existingConfig?: Record<string, unknown> | null;
    gatewayPort: number;
    gatewayToken: string;
    openClawInstallRoot?: string | null;
    pluginPath: string | null;
    version: string;
    workspacePluginPath?: string | null;
    workspaceDir: string;
}) {
    const pluginPaths = [
        input.pluginPath,
        input.cortexPluginPath,
        input.workspacePluginPath,
        input.codexPluginRoot,
    ].filter(
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
    const codexAuthConfig = buildCodexAuthConfig(input.codexAuthProfileId);

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
        ...(codexAuthConfig ? { auth: codexAuthConfig } : {}),
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
            allow: ['tavern', 'tavern-cortex', 'tavern-workspace', 'codex', 'openai'],
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
                paths: pluginPaths,
            },
            slots: {
                memory: 'none',
            },
        },
        tools: {
            profile: 'coding',
        },
    };

    const mergedConfig = mergeManagedOpenClawConfig(managedConfig, input.existingConfig);
    return applyManagedOpenClawPluginInstallSpecs(mergedConfig, [
        ...resolveDefaultManagedOpenClawPluginInstallSpecs({
            installRoot: input.openClawInstallRoot,
        }),
        ...resolveManagedOpenClawPluginInstallSpecs({
            config: mergedConfig,
            installRoot: input.openClawInstallRoot,
            version: input.version,
        }),
    ]);
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

async function resolveManagedCodexAuthProfileId() {
    const configuredProfileId = readConfigValue('TAVERN_OPENCLAW_CODEX_AUTH_PROFILE_ID');
    if (configuredProfileId) {
        return configuredProfileId;
    }

    const email = await readCodexAuthEmail();
    return email ? `openai-codex:${email}` : null;
}

async function readCodexAuthEmail() {
    try {
        const authPath = path.join(os.homedir(), '.codex', 'auth.json');
        const parsed = JSON.parse(await fs.readFile(authPath, 'utf8')) as {
            tokens?: { id_token?: string };
        };
        const payload = decodeJwtPayload(parsed.tokens?.id_token);
        return typeof payload.email === 'string' && payload.email.includes('@')
            ? payload.email
            : null;
    } catch {
        return null;
    }
}

function decodeJwtPayload(token: string | undefined) {
    if (!token) {
        return {};
    }

    const payload = token.split('.')[1];
    if (!payload) {
        return {};
    }

    try {
        return JSON.parse(Buffer.from(base64UrlToBase64(payload), 'base64').toString('utf8')) as {
            email?: unknown;
        };
    } catch {
        return {};
    }
}

function base64UrlToBase64(value: string) {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function buildCodexAuthConfig(profileId: string | null | undefined) {
    if (!profileId) {
        return null;
    }

    return {
        order: {
            'openai-codex': [profileId],
        },
        profiles: {
            [profileId]: {
                mode: 'oauth',
                provider: 'openai-codex',
            },
        },
    };
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
    'cortex_search',
    'cortex_get_page',
    'cortex_capture',
    'cortex_recall',
    'cortex_status',
    'cortex_list_backlinks',
    'cortex_run_job',
    'workspace_notes_read',
    'workspace_notes_update',
];

function createGatewayToken() {
    return `tavern-${crypto.randomBytes(24).toString('base64url')}`;
}
