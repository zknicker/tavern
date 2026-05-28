import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';

import { agentRuntimeRoutes } from '@tavern/api';
import { log } from '../log';
import { publishRuntimeEvent } from '../tavern/runtime-events';
import { syncManagedOpenClawSnapshotsInBackground } from './agent-sync';
import { prepareManagedOpenClawConfig } from './config';
import { ensureManagedOpenClawPlugins, resolveManagedOpenClawInstall } from './install';
import { createLocalOpenClawClient } from './local-client';
import { buildOpenClawLaunchCommand } from './sandbox';
import {
    markManagedOpenClawGatewayReady,
    markManagedOpenClawGatewayStopped,
    markTavernPluginInstalled,
} from './state';

export interface ManagedOpenClawHandle {
    stop(options?: { force?: boolean }): Promise<void>;
}

export async function startOpenClawForRuntime(): Promise<ManagedOpenClawHandle> {
    const install = await resolveManagedOpenClawInstall();
    const runtimeConfig = await prepareManagedOpenClawConfig({
        codexPluginRoot: install.codexPluginRoot,
        openClawInstallRoot: install.installRoot,
        openClawPackageRoot: install.packageRoot,
    });
    await ensureManagedOpenClawPlugins(install, runtimeConfig.pluginInstallSpecs);
    if (markTavernPluginInstalled(runtimeConfig.pluginPath)) {
        publishCapabilityUpdated('tavernPlugin');
    }
    const launchCommand = await buildOpenClawLaunchCommand(install.binPath, {
        installPath: install.packageRoot,
        stateDir: runtimeConfig.stateDir,
        workspaceDir: runtimeConfig.workspaceDir,
    });

    process.env.OPENCLAW_CONFIG_PATH = runtimeConfig.configPath;
    process.env.OPENCLAW_CONFIG_DIR = runtimeConfig.configDir;
    process.env.OPENCLAW_GATEWAY_TOKEN = runtimeConfig.gatewayToken;
    process.env.OPENCLAW_GATEWAY_URL = runtimeConfig.gatewayUrl;
    process.env.OPENCLAW_STATE_DIR = runtimeConfig.stateDir;
    process.env.TAVERN_API_BASE_URL = buildRuntimeApiBaseUrl();
    process.env.TAVERN_MANAGED_WORKSPACE_DIR = runtimeConfig.workspaceDir;
    process.env.TAVERN_RUNTIME_CHANNEL_URL = buildRuntimeChatSocketUrl();

    let child: ChildProcess | null = null;
    let stopping = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startGateway = (reason: 'initial' | 'restart') => {
        const gateway = spawnOpenClawGateway(launchCommand, runtimeConfig);
        child = gateway;
        attachRestartHandler(gateway);
        log.info('Managed OpenClaw Gateway starting', {
            gatewayUrl: runtimeConfig.gatewayUrl,
            reason,
            version: install.version,
        });
        void waitForGatewayReady(runtimeConfig.gatewayPort, gateway)
            .then(() => {
                if (stopping || child !== gateway) {
                    return;
                }

                if (markManagedOpenClawGatewayReady()) {
                    publishCapabilityUpdated('gateway');
                }
                syncManagedOpenClawSnapshotsInBackground('gateway-ready');
            })
            .catch((err) => {
                if (stopping || child !== gateway) {
                    return;
                }

                if (markManagedOpenClawGatewayStopped()) {
                    publishCapabilityUpdated('gateway');
                }
                log.error('Managed OpenClaw Gateway startup failed', { err });
                stopChild(gateway);
                scheduleRestart();
            });
    };

    const scheduleRestart = () => {
        if (stopping || restartTimer) {
            return;
        }

        restartTimer = setTimeout(() => {
            restartTimer = null;
            startGateway('restart');
        }, 500);
    };

    const attachRestartHandler = (nextChild: ChildProcess) => {
        nextChild.once('exit', (code, signal) => {
            if (stopping || nextChild !== child) {
                return;
            }

            child = null;
            if (markManagedOpenClawGatewayStopped()) {
                publishCapabilityUpdated('gateway');
            }
            log.warn('Managed OpenClaw Gateway exited; restarting', { code, signal });
            scheduleRestart();
        });
    };

    startGateway('initial');

    return {
        async stop(options?: { force?: boolean }) {
            stopping = true;
            if (restartTimer) {
                clearTimeout(restartTimer);
                restartTimer = null;
            }
            if (markManagedOpenClawGatewayStopped()) {
                publishCapabilityUpdated('gateway');
            }
            const gateway = child;
            child = null;
            if (gateway) {
                await stopChild(gateway, options);
            }
        },
    };
}

function publishCapabilityUpdated(capability: string) {
    publishRuntimeEvent({
        capability,
        timestamp: new Date().toISOString(),
        type: 'capability.updated',
    });
}

function spawnOpenClawGateway(
    command: string[],
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>
) {
    const [bin, ...prefixArgs] = command;
    if (!bin) {
        throw new Error('OpenClaw launch command is empty.');
    }

    return spawn(
        bin,
        [
            ...prefixArgs,
            'gateway',
            'run',
            '--port',
            `${runtimeConfig.gatewayPort}`,
            '--bind',
            'loopback',
            '--auth',
            'token',
            '--token',
            runtimeConfig.gatewayToken,
        ],
        {
            env: {
                ...process.env,
                TAVERN_RUNTIME_CHANNEL_URL:
                    process.env.TAVERN_RUNTIME_CHANNEL_URL ?? buildRuntimeChatSocketUrl(),
                TAVERN_API_BASE_URL: process.env.TAVERN_API_BASE_URL ?? buildRuntimeApiBaseUrl(),
                TAVERN_MANAGED_WORKSPACE_DIR: runtimeConfig.workspaceDir,
                OPENCLAW_CONFIG_DIR: runtimeConfig.configDir,
                OPENCLAW_CONFIG_PATH: runtimeConfig.configPath,
                OPENCLAW_GATEWAY_TOKEN: runtimeConfig.gatewayToken,
                OPENCLAW_STATE_DIR: runtimeConfig.stateDir,
            },
            stdio: ['ignore', 'inherit', 'inherit'],
        }
    );
}

function buildRuntimeChatSocketUrl() {
    return `ws://127.0.0.1:${process.env.TAVERN_RUNTIME_PORT || 4310}${agentRuntimeRoutes.chatSocket}`;
}

function buildRuntimeApiBaseUrl() {
    return `http://127.0.0.1:${process.env.TAVERN_RUNTIME_PORT || 4310}`;
}

async function stopChild(child: ChildProcess, options?: { force?: boolean }) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    await new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const interval = setInterval(() => {
            log.info('Still waiting for managed OpenClaw Gateway to stop', {
                elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
            });
        }, 5000);
        child.once('exit', () => {
            clearInterval(interval);
            resolve();
        });

        const signal = options?.force ? 'SIGKILL' : 'SIGTERM';
        log.info('Stopping managed OpenClaw Gateway', { pid: child.pid, signal });
        if (child.exitCode !== null || child.signalCode !== null || !child.kill(signal)) {
            clearInterval(interval);
            resolve();
        }
    });
}

async function waitForGateway(port: number, child: ChildProcess) {
    const timeoutMs = Number.parseInt(
        process.env.TAVERN_OPENCLAW_GATEWAY_START_TIMEOUT_MS ?? '180000',
        10
    );
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`Managed OpenClaw Gateway exited before listening on port ${port}.`);
        }

        if (await isPortOpen(port)) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for managed OpenClaw Gateway on port ${port}.`);
}

async function waitForGatewayReady(port: number, child: ChildProcess) {
    await waitForGateway(port, child);

    const timeoutMs = Number.parseInt(
        process.env.TAVERN_OPENCLAW_GATEWAY_START_TIMEOUT_MS ?? '180000',
        10
    );
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(
                `Managed OpenClaw Gateway exited before becoming ready on port ${port}.`
            );
        }

        const client = createLocalOpenClawClient();
        try {
            await client.getStatus();
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 100));
        } finally {
            client.close();
        }
    }

    throw new Error(`Timed out waiting for managed OpenClaw Gateway readiness on port ${port}.`);
}

function isPortOpen(port: number) {
    return new Promise((resolve) => {
        const socket = net.connect({ host: '127.0.0.1', port });
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => {
            socket.destroy();
            resolve(false);
        });
    });
}
