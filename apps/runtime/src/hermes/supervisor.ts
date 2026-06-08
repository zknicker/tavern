import { type ChildProcess, spawn } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeCapabilityHealthId } from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import {
    HERMES_DASHBOARD_SESSION_TOKEN,
    HERMES_HOME,
    HERMES_ROOT,
    readConfigValue,
    resolveConfiguredPath,
} from '../config';
import { log } from '../log';
import { publishRuntimeEvent } from '../tavern/runtime-events';
import { createLocalHermesClient } from './local-client';
import { prepareManagedHermesModelConfig, resolveManagedHermesModelConfig } from './model-config';
import {
    markManagedHermesApiReady,
    markManagedHermesApiStopped,
    markManagedHermesHome,
} from './state';

export interface ManagedHermesHandle {
    stop(options?: { force?: boolean }): Promise<void>;
}

export async function startHermesForRuntime(): Promise<ManagedHermesHandle> {
    await fs.mkdir(HERMES_HOME, { recursive: true });
    await fs.mkdir(HERMES_ROOT, { recursive: true });
    await prepareManagedHermesModelConfig();
    if (markManagedHermesHome(HERMES_HOME)) {
        publishCapabilityUpdated('dashboardServer');
    }

    const port = Number.parseInt(readConfigValue('TAVERN_HERMES_PORT') ?? '9119', 10);
    const host = readConfigValue('TAVERN_HERMES_HOST') ?? '127.0.0.1';
    let child: ChildProcess | null = null;
    let stopping = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const startDashboard = async (reason: 'initial' | 'restart') => {
        if (await isPortOpen(port)) {
            const client = createLocalHermesClient();
            try {
                await client.getStatus();
                await client.assertGatewayReady();
                await applyManagedHermesModelConfig(client);
                log.warn('Managed Hermes API port is already open; adopting existing process', {
                    port,
                    reason,
                });
                markManagedHermesApiReady();
                publishGatewayCapabilitiesUpdated();
            } catch (err) {
                log.warn('Managed Hermes API port is already open but is not usable', {
                    err,
                    port,
                    reason,
                });
                markManagedHermesApiStopped();
                publishGatewayCapabilitiesUpdated();
                scheduleRestart({ delayMs: 5000 });
            } finally {
                client.close();
            }
            return;
        }

        let nextChild: ChildProcess;
        try {
            nextChild = spawnHermesDashboard({ host, port });
        } catch (err) {
            markManagedHermesApiStopped();
            publishGatewayCapabilitiesUpdated();
            log.error('Managed Hermes API startup failed', { err });
            return;
        }
        child = nextChild;
        attachRestartHandler(nextChild);
        log.info('Managed Hermes API starting', {
            home: HERMES_HOME,
            port,
            reason,
        });
        void waitForHermesReady(port, nextChild)
            .then(() => {
                if (stopping || child !== nextChild) {
                    return;
                }
                markManagedHermesApiReady();
                publishGatewayCapabilitiesUpdated();
            })
            .catch((err) => {
                if (stopping || child !== nextChild) {
                    return;
                }
                markManagedHermesApiStopped();
                publishGatewayCapabilitiesUpdated();
                log.error('Managed Hermes API startup failed', { err });
                stopChild(nextChild);
                scheduleRestart({ delayMs: 5000 });
            });
    };

    const scheduleRestart = (options?: { delayMs?: number }) => {
        if (stopping || restartTimer) {
            return;
        }
        restartTimer = setTimeout(() => {
            restartTimer = null;
            void startDashboard('restart');
        }, options?.delayMs ?? 500);
    };

    const attachRestartHandler = (nextChild: ChildProcess) => {
        nextChild.once('error', (err) => {
            if (stopping || nextChild !== child) {
                return;
            }
            log.error('Managed Hermes API process failed', { err });
            child = null;
            markManagedHermesApiStopped();
            publishGatewayCapabilitiesUpdated();
            scheduleRestart({ delayMs: 5000 });
        });
        nextChild.once('exit', (code, signal) => {
            if (stopping || nextChild !== child) {
                return;
            }
            child = null;
            markManagedHermesApiStopped();
            publishGatewayCapabilitiesUpdated();
            log.warn('Managed Hermes API exited; restarting', { code, signal });
            scheduleRestart();
        });
    };

    void startDashboard('initial');

    return {
        async stop(options?: { force?: boolean }) {
            stopping = true;
            if (restartTimer) {
                clearTimeout(restartTimer);
                restartTimer = null;
            }
            markManagedHermesApiStopped();
            publishGatewayCapabilitiesUpdated();
            const hermes = child;
            child = null;
            if (hermes) {
                await stopChild(hermes, options);
            }
        },
    };
}

function spawnHermesDashboard(input: { host: string; port: number }) {
    const command = resolveHermesBinary();
    return spawn(
        command,
        ['dashboard', '--no-open', '--host', input.host, '--port', `${input.port}`],
        {
            env: {
                ...process.env,
                HERMES_DASHBOARD_SESSION_TOKEN,
                HERMES_HOME,
            },
            stdio: ['ignore', 'inherit', 'inherit'],
        }
    );
}

export function resolveHermesBinary(): string {
    const configured = readConfigValue('TAVERN_HERMES_BIN');
    if (configured) {
        const resolved = resolveConfiguredPath(configured);
        if (!isExecutableFile(resolved)) {
            throw new Error(`Configured Hermes binary is not executable: ${resolved}`);
        }
        return resolved;
    }

    const homeDir = process.env.HOME || os.homedir();
    for (const candidate of [
        path.join(homeDir, '.local', 'bin', 'hermes'),
        '/opt/homebrew/bin/hermes',
        '/usr/local/bin/hermes',
    ]) {
        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }

    const pathCandidate = findExecutableOnPath('hermes');
    if (pathCandidate) {
        return pathCandidate;
    }

    throw new Error(
        'Managed Hermes requires the Hermes CLI. Install Hermes or set TAVERN_HERMES_BIN to an executable Hermes binary.'
    );
}

function isExecutableFile(filePath: string) {
    try {
        fsSync.accessSync(filePath, fsSync.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function findExecutableOnPath(binaryName: string) {
    for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
        if (!directory) {
            continue;
        }
        const candidate = path.join(directory, binaryName);
        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }

    return null;
}

function publishGatewayCapabilitiesUpdated() {
    publishCapabilitiesUpdated(['apiServer', 'dashboardServer', 'gateway', 'models', 'skills']);
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

async function stopChild(child: ChildProcess, options?: { force?: boolean }) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    await new Promise<void>((resolve) => {
        const signal = options?.force ? 'SIGKILL' : 'SIGTERM';
        child.once('exit', () => resolve());
        log.info('Stopping managed Hermes API', { pid: child.pid, signal });
        if (child.exitCode !== null || child.signalCode !== null || !child.kill(signal)) {
            resolve();
        }
    });
}

async function waitForHermesReady(port: number, child: ChildProcess) {
    const timeoutMs = Number.parseInt(process.env.TAVERN_HERMES_START_TIMEOUT_MS ?? '180000', 10);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`Managed Hermes API exited before becoming ready on port ${port}.`);
        }

        if (await isPortOpen(port)) {
            const client = createLocalHermesClient();
            try {
                await client.getStatus();
                await client.assertGatewayReady();
                await applyManagedHermesModelConfig(client);
                return;
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 100));
            } finally {
                client.close();
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for managed Hermes API readiness on port ${port}.`);
}

async function applyManagedHermesModelConfig(client: ReturnType<typeof createLocalHermesClient>) {
    const config = await resolveManagedHermesModelConfig();
    await client
        .updateAgentModel('agt_hermes', {
            model: {
                baseUrl: config.baseUrl ?? undefined,
                harness: config.provider === 'openai-codex' ? 'codex' : 'pi',
                model: config.model,
                provider: config.provider,
            },
        })
        .catch((err) => {
            log.warn('Managed Hermes model config could not be applied through API', { err });
        });
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
