import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import type { AgentRuntimeCapabilityHealthId } from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import {
    getRuntimeApiToken,
    HERMES_DASHBOARD_SESSION_TOKEN,
    HERMES_HOME,
    HERMES_ROOT,
    readConfigValue,
} from '../config';
import { log } from '../log';
import { hasActiveHermesTurns } from '../tavern/hermes-turn-runner';
import { publishRuntimeEvent } from '../tavern/runtime-events';
import { ensureHermesBinary } from './bootstrap';
import { isManagedHermesSetupError } from './errors';
import { buildRuntimeApiBaseUrl, createLocalHermesClient } from './local-client';
import { resolveManagedVaultPath } from './managed-vault';
import { prepareManagedHermesModelConfig, resolveManagedHermesModelConfig } from './model-config';
import { createRestartCoordinator, type RestartCoordinator } from './restart-coordinator';
import {
    markManagedHermesApiReady,
    markManagedHermesApiStopped,
    markManagedHermesBootstrap,
    markManagedHermesHome,
} from './state';
import { ensureTavernMessengerPlugin } from './tavern-messenger-plugin';

export interface ManagedHermesHandle {
    stop(options?: { force?: boolean }): Promise<void>;
}

let activeRestartCoordinator: RestartCoordinator | null = null;

/**
 * Schedule a managed Hermes restart so it picks up generated config changes.
 * Requests are coalesced — a burst of settings saves produces one restart,
 * deferred (bounded) while a chat turn is active. Returns false when no
 * managed Hermes supervisor is active (e.g. external Hermes or tests);
 * callers surface that as restart-not-scheduled.
 */
export function requestManagedHermesRestart(): boolean {
    if (!activeRestartCoordinator) {
        return false;
    }
    activeRestartCoordinator.request();
    publishEngineRestartPhase('scheduled');
    return true;
}

function publishEngineRestartPhase(phase: 'completed' | 'restarting' | 'scheduled') {
    publishRuntimeEvent({
        phase,
        timestamp: new Date().toISOString(),
        type: 'engine.restart',
    });
}

export async function startHermesForRuntime(): Promise<ManagedHermesHandle> {
    await fs.mkdir(HERMES_HOME, { recursive: true });
    await fs.mkdir(HERMES_ROOT, { recursive: true });
    const hermesBinary = await prepareManagedHermesSetup();
    if (markManagedHermesHome(HERMES_HOME)) {
        publishCapabilityUpdated('dashboardServer');
    }

    const port = Number.parseInt(readConfigValue('TAVERN_HERMES_PORT') ?? '9119', 10);
    const host = readConfigValue('TAVERN_HERMES_HOST') ?? '127.0.0.1';
    let child: ChildProcess | null = null;
    let stopping = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let coordinatedRestartPending = false;

    const startDashboard = async (reason: 'initial' | 'restart') => {
        if (await isPortOpen(port)) {
            log.warn('Managed Hermes API port is already open; not adopting existing process', {
                port,
                reason,
                vaultPath: resolveManagedVaultPath(),
            });
            markManagedHermesApiStopped();
            publishGatewayCapabilitiesUpdated();
            scheduleRestart({ delayMs: 5000 });
            return;
        }

        let nextChild: ChildProcess;
        try {
            nextChild = spawnHermesDashboard({ command: hermesBinary, host, port });
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
                if (coordinatedRestartPending) {
                    coordinatedRestartPending = false;
                    publishEngineRestartPhase('completed');
                }
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

    activeRestartCoordinator = createRestartCoordinator({
        hasActiveTurns: hasActiveHermesTurns,
        restart: () => {
            if (stopping) {
                return;
            }
            coordinatedRestartPending = true;
            publishEngineRestartPhase('restarting');
            const current = child;
            if (current) {
                log.info('Restarting managed Hermes API to apply generated config');
                // The exit handler observes stopping=false and schedules the restart.
                void stopChild(current);
                return;
            }
            scheduleRestart();
        },
    });

    return {
        async stop(options?: { force?: boolean }) {
            stopping = true;
            activeRestartCoordinator?.dispose();
            activeRestartCoordinator = null;
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

async function prepareManagedHermesSetup(): Promise<string> {
    try {
        const resolved = await ensureHermesBinary({
            onPhase: (phase) => {
                markManagedHermesBootstrap(phase === 'installing' ? 'installing' : 'idle');
                publishGatewayCapabilitiesUpdated();
            },
        });
        await ensureTavernMessengerPlugin();
        await prepareManagedHermesModelConfig({ hermesBinary: resolved.binaryPath });
        return resolved.binaryPath;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        markManagedHermesBootstrap('failed', message);
        markManagedHermesApiStopped();
        publishGatewayCapabilitiesUpdated();
        log.error('Managed Hermes setup failed; cannot start dashboard', {
            setup: isManagedHermesSetupError(err),
            hint: message,
        });
        throw err;
    }
}

function spawnHermesDashboard(input: { command: string; host: string; port: number }) {
    return spawn(
        input.command,
        ['dashboard', '--no-open', '--host', input.host, '--port', `${input.port}`],
        {
            env: buildHermesDashboardEnv(),
            stdio: ['ignore', 'inherit', 'inherit'],
        }
    );
}

export function buildHermesDashboardEnv() {
    const env: Record<string, string | undefined> = {
        ...process.env,
        HERMES_DESKTOP: '1',
        HERMES_DASHBOARD_SESSION_TOKEN,
        HERMES_HOME,
        TAVERN_RUNTIME_TOKEN: getRuntimeApiToken(),
        TAVERN_RUNTIME_URL: buildRuntimeApiBaseUrl(),
        TAVERN_VAULT_PATH: resolveManagedVaultPath(),
    };
    // The official launcher unsets PYTHONPATH before exec; mirror it because the
    // managed engine binary is the venv executable, not the launcher wrapper.
    // spawn() omits env keys whose value is undefined.
    env.PYTHONPATH = undefined;
    // On a host with no system Node, the installer bundles Node under
    // HERMES_HOME/node and symlinks it into ~/.local/bin — but that symlink is
    // written into the throwaway install sandbox and discarded. Put the bundled
    // Node on PATH so the managed dashboard resolves it regardless of how Hermes
    // looks it up. No-op when the host has its own Node (dir absent).
    const managedNodeBin = path.join(HERMES_HOME, 'node', 'bin');
    if (existsSync(managedNodeBin)) {
        env.PATH = `${managedNodeBin}${path.delimiter}${env.PATH ?? ''}`;
    }
    return env;
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
    if (!(config.model && config.provider)) {
        log.warn('Managed Hermes model config has no runnable default route');
        return;
    }
    await client
        .applyDefaultAgentModel({
            model: {
                baseUrl: config.baseUrl ?? undefined,
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
