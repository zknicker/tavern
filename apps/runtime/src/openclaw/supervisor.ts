import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';

import { agentRuntimeRoutes } from '@tavern/api';
import { log } from '../log';
import { prepareManagedOpenClawConfig } from './config';
import { ensureManagedOpenClawPlugins, resolveManagedOpenClawInstall } from './install';
import { buildOpenClawLaunchCommand } from './sandbox';
import {
    markManagedOpenClawGatewayReady,
    markManagedOpenClawGatewayStopped,
    markTavernPluginInstalled,
} from './state';

export interface ManagedOpenClawHandle {
    stop(): void;
}

export async function startOpenClawForRuntime(): Promise<ManagedOpenClawHandle> {
    const install = await resolveManagedOpenClawInstall();
    const runtimeConfig = await prepareManagedOpenClawConfig({
        codexPluginRoot: install.codexPluginRoot,
        openClawInstallRoot: install.installRoot,
        openClawPackageRoot: install.packageRoot,
    });
    await ensureManagedOpenClawPlugins(install, runtimeConfig.pluginInstallSpecs);
    markTavernPluginInstalled(runtimeConfig.pluginPath);
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
        child = spawnOpenClawGateway(launchCommand, runtimeConfig);
        attachRestartHandler(child);
        log.info('Managed OpenClaw Gateway starting', {
            gatewayUrl: runtimeConfig.gatewayUrl,
            reason,
            version: install.version,
        });
        await waitForGateway(runtimeConfig.gatewayPort, child);
        markManagedOpenClawGatewayReady();
    };

    const scheduleRestart = () => {
        if (stopping || restartTimer) {
            return;
        }

        restartTimer = setTimeout(() => {
            restartTimer = null;
            void startGateway('restart').catch((err) => {
                markManagedOpenClawGatewayStopped();
                log.error('Managed OpenClaw Gateway restart failed', { err });
                scheduleRestart();
            });
        }, 500);
    };

    const attachRestartHandler = (nextChild: ChildProcess) => {
        nextChild.once('exit', (code, signal) => {
            if (stopping || nextChild !== child) {
                return;
            }

            child = null;
            markManagedOpenClawGatewayStopped();
            log.warn('Managed OpenClaw Gateway exited; restarting', { code, signal });
            scheduleRestart();
        });
    };

    await startGateway('initial');

    return {
        stop() {
            stopping = true;
            if (restartTimer) {
                clearTimeout(restartTimer);
                restartTimer = null;
            }
            markManagedOpenClawGatewayStopped();
            if (child) {
                stopChild(child);
                child = null;
            }
        },
    };
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

function stopChild(child: ChildProcess) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    child.kill('SIGTERM');
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
