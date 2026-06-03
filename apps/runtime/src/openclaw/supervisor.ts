import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { type AgentRuntimeCapabilityHealthId, agentRuntimeRoutes } from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { getRuntimePort } from '../config';
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

    const startGateway = async (reason: 'initial' | 'restart') => {
        if (await isPortOpen(runtimeConfig.gatewayPort)) {
            if (await stopRecordedManagedGateway(runtimeConfig)) {
                log.warn('Stopped stale managed OpenClaw Gateway before restart', {
                    gatewayUrl: runtimeConfig.gatewayUrl,
                    reason,
                });
            } else {
                log.error('Managed OpenClaw Gateway port is already in use; not restarting', {
                    gatewayUrl: runtimeConfig.gatewayUrl,
                    port: runtimeConfig.gatewayPort,
                    reason,
                });
                markManagedOpenClawGatewayStopped();
                publishGatewayCapabilitiesUpdated();
                scheduleRestart({ delayMs: 5000 });
                return;
            }
        }

        if (await isPortOpen(runtimeConfig.gatewayPort)) {
            log.error('Managed OpenClaw Gateway port is already in use; not restarting', {
                gatewayUrl: runtimeConfig.gatewayUrl,
                port: runtimeConfig.gatewayPort,
                reason,
            });
            markManagedOpenClawGatewayStopped();
            publishGatewayCapabilitiesUpdated();
            scheduleRestart({ delayMs: 5000 });
            return;
        }

        const gateway = spawnOpenClawGateway(launchCommand, runtimeConfig);
        child = gateway;
        void writeManagedGatewayHandoff(runtimeConfig, gateway);
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

                markManagedOpenClawGatewayReady();
                publishGatewayReadyCapabilitiesUpdated();
                void syncManagedOpenClawSnapshotsInBackground('gateway-ready').finally(() => {
                    publishOpenClawSnapshotCapabilitiesUpdated();
                });
            })
            .catch((err) => {
                if (stopping || child !== gateway) {
                    return;
                }

                markManagedOpenClawGatewayStopped();
                publishGatewayCapabilitiesUpdated();
                log.error('Managed OpenClaw Gateway startup failed', { err });
                stopChild(gateway);
                scheduleRestart();
            });
    };

    const scheduleRestart = (options?: { delayMs?: number }) => {
        if (stopping || restartTimer) {
            return;
        }

        restartTimer = setTimeout(() => {
            restartTimer = null;
            void startGateway('restart');
        }, options?.delayMs ?? 500);
    };

    const attachRestartHandler = (nextChild: ChildProcess) => {
        nextChild.once('exit', (code, signal) => {
            if (stopping || nextChild !== child) {
                return;
            }

            child = null;
            void clearManagedGatewayHandoff(runtimeConfig, nextChild.pid);
            markManagedOpenClawGatewayStopped();
            publishGatewayCapabilitiesUpdated();
            log.warn('Managed OpenClaw Gateway exited; restarting', { code, signal });
            scheduleRestart();
        });
    };

    void startGateway('initial');

    return {
        async stop(options?: { force?: boolean }) {
            stopping = true;
            if (restartTimer) {
                clearTimeout(restartTimer);
                restartTimer = null;
            }
            markManagedOpenClawGatewayStopped();
            publishGatewayCapabilitiesUpdated();
            const gateway = child;
            child = null;
            if (gateway) {
                await stopChild(gateway, options);
                await clearManagedGatewayHandoff(runtimeConfig, gateway.pid);
            }
        },
    };
}

interface ManagedGatewayHandoff {
    configPath: string;
    gatewayPort: number;
    pid: number;
    stateDir: string;
    updatedAt: string;
}

function publishGatewayCapabilitiesUpdated() {
    publishCapabilitiesUpdated(['gateway', 'memory', 'models', 'skills']);
}

function publishGatewayReadyCapabilitiesUpdated() {
    publishCapabilitiesUpdated(['gateway', 'memory']);
}

function publishOpenClawSnapshotCapabilitiesUpdated() {
    publishCapabilitiesUpdated(['models', 'skills']);
}

function publishCapabilityUpdated(capability: AgentRuntimeCapabilityHealthId) {
    publishCapabilitiesUpdated([capability]);
}

function publishCapabilitiesUpdated(capabilities: AgentRuntimeCapabilityHealthId[]) {
    void refreshRuntimeCapabilities({ ids: capabilities })
        .catch((err) => {
            log.warn('Failed to refresh Runtime capability before publishing update', {
                capabilities,
                err,
            });
        })
        .finally(() => {
            const timestamp = new Date().toISOString();
            for (const capability of capabilities) {
                publishRuntimeEvent({
                    capability,
                    timestamp,
                    type: 'capability.updated',
                });
            }
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
    return `ws://127.0.0.1:${getRuntimePort()}${agentRuntimeRoutes.chatSocket}`;
}

function buildRuntimeApiBaseUrl() {
    return `http://127.0.0.1:${getRuntimePort()}`;
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

async function stopRecordedManagedGateway(
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>
) {
    const handoff = await readManagedGatewayHandoff(runtimeConfig);
    if (!handoff || handoff.gatewayPort !== runtimeConfig.gatewayPort) {
        return false;
    }
    if (
        handoff.configPath !== runtimeConfig.configPath ||
        handoff.stateDir !== runtimeConfig.stateDir
    ) {
        return false;
    }
    if (!isPidAlive(handoff.pid)) {
        await clearManagedGatewayHandoff(runtimeConfig, handoff.pid);
        return false;
    }

    log.warn('Stopping stale managed OpenClaw Gateway from previous Runtime process', {
        pid: handoff.pid,
        port: handoff.gatewayPort,
    });
    try {
        process.kill(handoff.pid, 'SIGTERM');
    } catch {
        await clearManagedGatewayHandoff(runtimeConfig, handoff.pid);
        return false;
    }

    const stopped = await waitForPortClosed(runtimeConfig.gatewayPort, 5000);
    if (!stopped && isPidAlive(handoff.pid)) {
        log.warn('Force stopping stale managed OpenClaw Gateway', { pid: handoff.pid });
        try {
            process.kill(handoff.pid, 'SIGKILL');
        } catch {}
    }

    const cleared = stopped || (await waitForPortClosed(runtimeConfig.gatewayPort, 5000));
    if (cleared) {
        await clearManagedGatewayHandoff(runtimeConfig, handoff.pid);
    }
    return cleared;
}

async function writeManagedGatewayHandoff(
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>,
    child: ChildProcess
) {
    if (!child.pid) {
        return;
    }
    await fs
        .writeFile(
            managedGatewayHandoffPath(runtimeConfig),
            `${JSON.stringify(
                {
                    configPath: runtimeConfig.configPath,
                    gatewayPort: runtimeConfig.gatewayPort,
                    pid: child.pid,
                    stateDir: runtimeConfig.stateDir,
                    updatedAt: new Date().toISOString(),
                } satisfies ManagedGatewayHandoff,
                null,
                2
            )}\n`,
            { mode: 0o600 }
        )
        .catch((err) => {
            log.warn('Failed to write managed OpenClaw Gateway handoff', { err });
        });
}

async function readManagedGatewayHandoff(
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>
) {
    try {
        const parsed = JSON.parse(
            await fs.readFile(managedGatewayHandoffPath(runtimeConfig), 'utf8')
        ) as Partial<ManagedGatewayHandoff>;
        return typeof parsed.pid === 'number' &&
            typeof parsed.gatewayPort === 'number' &&
            typeof parsed.configPath === 'string' &&
            typeof parsed.stateDir === 'string'
            ? (parsed as ManagedGatewayHandoff)
            : null;
    } catch {
        return null;
    }
}

async function clearManagedGatewayHandoff(
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>,
    pid: number | undefined
) {
    const handoff = await readManagedGatewayHandoff(runtimeConfig);
    if (handoff && pid && handoff.pid !== pid) {
        return;
    }
    await fs.rm(managedGatewayHandoffPath(runtimeConfig), { force: true }).catch(() => undefined);
}

function managedGatewayHandoffPath(
    runtimeConfig: Awaited<ReturnType<typeof prepareManagedOpenClawConfig>>
) {
    return path.join(runtimeConfig.stateDir, 'tavern-managed-gateway-handoff.json');
}

function isPidAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function waitForPortClosed(port: number, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!(await isPortOpen(port))) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return !(await isPortOpen(port));
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
