import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
    assertDevStackPortsAvailable,
    buildManagedOpenClawPlugin,
    cleanupStaleProcesses,
    createDevStackConfig,
    createDevStackEnvironment,
    getManagedOpenClawPluginPackagePaths,
    isDesktopMode,
    isRuntimeMode,
    isSuppressedStartupLine,
    startupEventPrefix,
    stripAnsi,
    waitForPort,
    waitForRuntimeReady,
} from './dev-stack-shared.mjs';

const shutdownProcessOrder = ['desktop', 'website', 'server', 'runtime'];
const shutdownTimeoutMs = Number.parseInt(
    process.env.TAVERN_DEV_SHUTDOWN_TIMEOUT_MS ?? '30000',
    10
);
const processGroupShutdownPollMs = 50;
const pluginRestartDebounceMs = 250;

export class DevStackController extends EventEmitter {
    constructor({ mode, ports, repositoryRoot }) {
        super();
        this.mode = mode;
        this.ports = ports;
        this.repositoryRoot = repositoryRoot;
        this.processes = new Map();
        this.backgroundProcesses = new Set();
        this.expectedProcessStops = new Set();
        this.managedOpenClawPluginRestartPromise = null;
        this.managedOpenClawPluginRestartQueued = false;
        this.managedOpenClawPluginWatchers = [];
        this.managedOpenClawPluginWatchTimer = null;
        this.isStopping = false;
        this.isSteadyState = false;
        this.stopPromise = null;
        this.snapshot = this.createInitialSnapshot();
    }

    createInitialSnapshot() {
        const hasRuntime = isRuntimeMode(this.mode);
        const isDesktop = isDesktopMode(this.mode);

        return {
            config: createDevStackConfig({
                mode: this.mode,
                ports: this.ports,
                repositoryRoot: this.repositoryRoot,
            }),
            phase: 'starting',
            jobs: {
                items: [],
                state: 'idle',
            },
            logs: [],
            processes: {
                desktop: { status: isDesktop ? 'waiting' : 'disabled' },
                runtime: { status: hasRuntime ? 'waiting' : 'disabled' },
                server: { status: 'waiting' },
                website: { status: 'waiting' },
            },
            staleCleanupCount: 0,
        };
    }

    getSnapshot() {
        return this.snapshot;
    }

    update(mutator) {
        mutator(this.snapshot);
        this.emit('update', this.snapshot);
        this.maybeEnterSteadyState();
    }

    addLog(source, line) {
        if (!line || isSuppressedStartupLine(source, line)) {
            return;
        }

        const entry = { line, source };
        this.update((snapshot) => {
            snapshot.logs = [...snapshot.logs, entry].slice(-40);
        });
        this.emit('log', entry);
    }

    applyStartupEvent(event) {
        this.update((snapshot) => {
            if (event.source === 'server' && event.type === 'jobs.loading') {
                snapshot.jobs.state = 'loading';
                return;
            }

            if (event.source === 'server' && event.type === 'jobs.ready') {
                snapshot.jobs.state = 'ready';
                return;
            }

            if (event.source === 'server' && event.type === 'jobs.item') {
                const existingIndex = snapshot.jobs.items.findIndex(
                    (item) => item.key === event.payload.key
                );
                const nextItem = {
                    cadence: event.payload.cadence,
                    immediate: event.payload.immediate,
                    key: event.payload.key,
                    label: event.payload.label,
                    state: event.payload.state,
                };

                if (existingIndex === -1) {
                    snapshot.jobs.items = [...snapshot.jobs.items, nextItem].sort((left, right) =>
                        left.label.localeCompare(right.label)
                    );
                } else {
                    snapshot.jobs.items = snapshot.jobs.items.map((item, index) =>
                        index === existingIndex ? nextItem : item
                    );
                }
                return;
            }

            if (event.source === 'runtime' && event.type === 'runtime.ready') {
                snapshot.processes.runtime.status = 'running';
            }
        });
    }

    parseOutputLine(source, line) {
        const normalizedLine = stripAnsi(line);

        if (source === 'desktop' && /Running `.*tavern-desktop`/u.test(normalizedLine)) {
            this.addLog(source, normalizedLine);
            this.update((snapshot) => {
                snapshot.processes.desktop.status = 'running';
            });
            return;
        }

        if (normalizedLine.startsWith(startupEventPrefix)) {
            try {
                const event = JSON.parse(normalizedLine.slice(startupEventPrefix.length));
                this.applyStartupEvent(event);
            } catch {
                this.addLog(source, normalizedLine);
            }
            return;
        }

        this.addLog(source, normalizedLine);
    }

    attachProcessOutput(source, child) {
        const attach = (stream) => {
            if (!stream) {
                return;
            }

            const reader = readline.createInterface({ input: stream });
            reader.on('line', (line) => {
                this.parseOutputLine(source, line);
            });
        };

        attach(child.stdout);
        attach(child.stderr);
    }

    spawnProcess(source, command, env = process.env) {
        this.update((snapshot) => {
            snapshot.processes[source].status = 'starting';
        });

        const child = spawn(command, {
            cwd: this.repositoryRoot,
            detached: true,
            env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.processes.set(source, child);
        this.attachProcessOutput(source, child);

        child.on('exit', (code, signal) => {
            if (this.expectedProcessStops.delete(source)) {
                return;
            }
            if (!this.isStopping) {
                this.update((snapshot) => {
                    snapshot.processes[source].status = code === 0 ? 'stopped' : 'error';
                });
                this.addLog(source, `process exited (${signal ?? code ?? 'unknown'})`);
                void this.stop(code ?? 1);
            }
        });

        child.on('error', (error) => {
            this.update((snapshot) => {
                snapshot.processes[source].status = 'error';
            });
            this.addLog(source, error.message);
            void this.stop(1);
        });
    }

    spawnBackgroundProcess(source, command, env = process.env) {
        const child = spawn(command, {
            cwd: this.repositoryRoot,
            detached: true,
            env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.attachProcessOutput(source, child);
        this.backgroundProcesses.add(child);

        return new Promise((resolve) => {
            child.on('exit', (code, signal) => {
                this.backgroundProcesses.delete(child);
                if (code !== 0 && !this.isStopping) {
                    this.addLog(source, `prebuild exited (${signal ?? code ?? 'unknown'})`);
                }
                resolve(code === 0);
            });

            child.on('error', (error) => {
                this.backgroundProcesses.delete(child);
                if (!this.isStopping) {
                    this.addLog(source, error.message);
                }
                resolve(false);
            });
        });
    }

    cleanupStaleProcesses() {
        this.update((snapshot) => {
            snapshot.staleCleanupCount = cleanupStaleProcesses({
                mode: this.mode,
                ports: this.ports,
                repositoryRoot: this.repositoryRoot,
            });
        });
    }

    async start() {
        this.cleanupStaleProcesses();
        assertDevStackPortsAvailable({
            mode: this.mode,
            ports: this.ports,
            repositoryRoot: this.repositoryRoot,
        });

        const devStackEnvironment = createDevStackEnvironment({
            repositoryRoot: this.repositoryRoot,
        });
        const startupUiEnv = {
            ...devStackEnvironment,
            TAVERN_STARTUP_UI: '1',
        };

        const hasRuntime = isRuntimeMode(this.mode);
        const serverCommand = 'cd apps/server && TAVERN_EXIT_ON_ORPHAN=1 bun --watch src/index.ts';
        const serverEnv = hasRuntime
            ? {
                  ...startupUiEnv,
                  TAVERN_RUNTIME_URL: 'http://127.0.0.1:18790',
              }
            : startupUiEnv;
        let websiteReadyPromise = null;
        let desktopPrebuildPromise = null;

        const startWebsite = () => {
            if (!websiteReadyPromise) {
                this.spawnProcess(
                    'website',
                    'cd apps/website && bun x vite --host 127.0.0.1',
                    process.env
                );
                websiteReadyPromise = waitForPort(Number(this.ports.websitePort)).then(() => {
                    this.update((snapshot) => {
                        snapshot.processes.website.status = 'running';
                    });
                });
            }
        };

        const getDesktopEnv = () => ({
            ...process.env,
            TAVERN_DEV_STACK_HAS_RUNTIME: hasRuntime ? '1' : '0',
            TAVERN_OPENCLAW_GATEWAY_PORT: process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789',
            TAVERN_RUNTIME_PORT: '18790',
            TAVERN_SERVER_PORT: String(this.ports.serverPort),
            TAVERN_WEBSITE_PORT: String(this.ports.websitePort),
        });

        const startDesktopPrebuild = () => {
            if (!(isDesktopMode(this.mode) && !desktopPrebuildPromise)) {
                return;
            }

            const desktopEnv = getDesktopEnv();
            const prebuildCommand = [
                'node scripts/build-macos-app-icon.mjs',
                'node scripts/build-electron-sidecar.mjs',
            ].join(' && ');
            desktopPrebuildPromise = this.spawnBackgroundProcess(
                'desktop',
                prebuildCommand,
                desktopEnv
            );
        };

        if (hasRuntime) {
            this.addLog('runtime', 'building Tavern Messenger plugin');
            buildManagedOpenClawPlugin({
                repositoryRoot: this.repositoryRoot,
            });
            this.spawnProcess(
                'runtime',
                'cd apps/runtime && bun --watch src/index.ts',
                startupUiEnv
            );
            startWebsite();
            startDesktopPrebuild();
            await waitForRuntimeReady();
            this.update((snapshot) => {
                snapshot.processes.runtime.status = 'running';
            });
            this.watchManagedOpenClawPluginPackages(startupUiEnv);
        }

        this.spawnProcess('server', serverCommand, serverEnv);
        await waitForPort(Number(this.ports.serverPort));
        this.update((snapshot) => {
            snapshot.processes.server.status = 'running';
        });

        startWebsite();
        await websiteReadyPromise;

        if (isDesktopMode(this.mode)) {
            if (desktopPrebuildPromise) {
                await desktopPrebuildPromise;
            }
            this.spawnProcess(
                'desktop',
                'node scripts/run-desktop-dev.mjs --skip-server-cleanup',
                getDesktopEnv()
            );
            this.update((snapshot) => {
                snapshot.processes.desktop.status = 'running';
            });
        }

        this.maybeEnterSteadyState();
    }

    async stop(exitCode = 0, options = {}) {
        if (this.stopPromise) {
            if (options.force) {
                this.signalManagedProcesses('SIGTERM');
            }
            return this.stopPromise;
        }
        this.isStopping = true;

        this.stopPromise = (async () => {
            this.closeManagedOpenClawPluginWatchers();
            this.addLog(
                'tavern',
                options.signal ? `shutdown requested (${options.signal})` : 'shutdown requested'
            );
            this.update((snapshot) => {
                snapshot.phase = 'stopping';
            });

            this.signalBackgroundProcesses('SIGTERM');

            for (const source of shutdownProcessOrder) {
                await this.stopProcess(source);
            }

            this.emit('exit', exitCode);
        })();

        return this.stopPromise;
    }

    signalManagedProcesses(signal) {
        for (const child of this.processes.values()) {
            signalChildProcessGroup(child, signal);
        }
        this.signalBackgroundProcesses(signal);
    }

    signalBackgroundProcesses(signal) {
        for (const child of this.backgroundProcesses) {
            signalChildProcessGroup(child, signal);
        }
    }

    async stopProcess(source, options = {}) {
        const child = this.processes.get(source);

        if (!child) {
            return;
        }

        this.update((snapshot) => {
            snapshot.processes[source].status = 'stopping';
        });
        this.addLog(
            source,
            source === 'runtime' ? 'stopping; waiting for managed OpenClaw Gateway' : 'stopping'
        );

        if (options.expected) {
            this.expectedProcessStops.add(source);
        }

        const stopped = await waitForChildShutdown(child, () => {
            signalChildProcessGroup(child, 'SIGTERM');
        });
        this.expectedProcessStops.delete(source);

        if (!stopped) {
            this.addLog(
                source,
                `shutdown timed out after ${Math.round(shutdownTimeoutMs / 1000)}s; killing`
            );
            signalChildProcessGroup(child, 'SIGKILL');
            await waitForChildShutdown(child);
        }

        this.processes.delete(source);
        this.update((snapshot) => {
            snapshot.processes[source].status = 'stopped';
        });
    }

    watchManagedOpenClawPluginPackages(runtimeEnv) {
        if (this.managedOpenClawPluginWatchers.length > 0) {
            return;
        }

        for (const pluginPackage of getManagedOpenClawPluginPackagePaths({
            repositoryRoot: this.repositoryRoot,
        })) {
            try {
                const watcher = fs.watch(
                    pluginPackage.path,
                    { recursive: true },
                    (_eventType, fileName) => {
                        const changedPath =
                            typeof fileName === 'string'
                                ? path.join(pluginPackage.path, fileName)
                                : pluginPackage.path;

                        if (shouldIgnorePluginWatchPath(changedPath)) {
                            return;
                        }

                        this.queueManagedOpenClawPluginRestart(runtimeEnv, pluginPackage.directory);
                    }
                );
                this.managedOpenClawPluginWatchers.push(watcher);
            } catch (error) {
                this.addLog(
                    'runtime',
                    `OpenClaw plugin watch unavailable for ${pluginPackage.directory}: ${formatError(error)}`
                );
            }
        }

        if (this.managedOpenClawPluginWatchers.length > 0) {
            this.addLog('runtime', 'watching Tavern OpenClaw plugins');
        }
    }

    closeManagedOpenClawPluginWatchers() {
        if (this.managedOpenClawPluginWatchTimer) {
            clearTimeout(this.managedOpenClawPluginWatchTimer);
            this.managedOpenClawPluginWatchTimer = null;
        }

        for (const watcher of this.managedOpenClawPluginWatchers) {
            watcher.close();
        }

        this.managedOpenClawPluginWatchers = [];
    }

    queueManagedOpenClawPluginRestart(runtimeEnv, changedPackage) {
        if (this.isStopping) {
            return;
        }

        this.managedOpenClawPluginRestartQueued = true;
        if (this.managedOpenClawPluginWatchTimer) {
            clearTimeout(this.managedOpenClawPluginWatchTimer);
        }

        this.managedOpenClawPluginWatchTimer = setTimeout(() => {
            this.managedOpenClawPluginWatchTimer = null;
            void this.restartManagedRuntimeForPluginChange(runtimeEnv, changedPackage);
        }, pluginRestartDebounceMs);
    }

    async restartManagedRuntimeForPluginChange(runtimeEnv, changedPackage) {
        if (this.managedOpenClawPluginRestartPromise) {
            this.managedOpenClawPluginRestartQueued = true;
            await this.managedOpenClawPluginRestartPromise;
            return;
        }

        this.managedOpenClawPluginRestartQueued = false;
        this.managedOpenClawPluginRestartPromise = this.runManagedRuntimePluginRestart(
            runtimeEnv,
            changedPackage
        );

        try {
            await this.managedOpenClawPluginRestartPromise;
        } finally {
            this.managedOpenClawPluginRestartPromise = null;
        }

        if (this.managedOpenClawPluginRestartQueued && !this.isStopping) {
            this.queueManagedOpenClawPluginRestart(runtimeEnv, 'queued plugin change');
        }
    }

    async runManagedRuntimePluginRestart(runtimeEnv, changedPackage) {
        if (this.isStopping) {
            return;
        }

        this.addLog(
            'runtime',
            `Tavern OpenClaw plugin changed (${changedPackage}); rebuilding managed plugins`
        );

        try {
            buildManagedOpenClawPlugin({
                repositoryRoot: this.repositoryRoot,
            });
        } catch (error) {
            this.addLog('runtime', `managed OpenClaw plugin rebuild failed: ${formatError(error)}`);
            return;
        }

        if (this.isStopping) {
            return;
        }

        this.addLog('runtime', 'managed plugins rebuilt; restarting Runtime to sync OpenClaw');
        await this.stopProcess('runtime', { expected: true });

        if (this.isStopping) {
            return;
        }

        try {
            this.spawnProcess('runtime', 'cd apps/runtime && bun --watch src/index.ts', runtimeEnv);
            await waitForRuntimeReady();
            this.update((snapshot) => {
                snapshot.processes.runtime.status = 'running';
            });
            this.addLog('runtime', 'managed OpenClaw plugins synced');
        } catch (error) {
            this.addLog('runtime', `managed Runtime restart failed: ${formatError(error)}`);
            void this.stop(1);
        }
    }

    maybeEnterSteadyState() {
        if (this.isSteadyState || !isStartupComplete(this.snapshot)) {
            return;
        }

        this.isSteadyState = true;
        this.update((snapshot) => {
            snapshot.phase = 'running';
        });
        this.emit('steady');
    }
}

function shouldIgnorePluginWatchPath(filePath) {
    const parts = filePath.split(path.sep);
    return parts.some((part) =>
        ['.git', '.turbo', 'coverage', 'dist', 'node_modules'].includes(part)
    );
}

function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}

function signalChildProcessGroup(child, signal) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
        return false;
    }

    try {
        process.kill(-child.pid, signal);
        return true;
    } catch {
        return child.kill(signal);
    }
}

export function waitForChildShutdown(child, beforeWait, options = {}) {
    const isProcessGroupActive =
        options.isProcessGroupActive ??
        (() => {
            return isChildProcessGroupActive(child);
        });
    const pollMs = options.pollMs ?? processGroupShutdownPollMs;
    const timeoutMs = options.timeoutMs ?? shutdownTimeoutMs;
    let childExited = child.exitCode !== null || child.signalCode !== null;

    if (!child.pid) {
        return Promise.resolve(childExited);
    }

    return new Promise((resolve) => {
        let interval = null;
        const timeout = setTimeout(() => {
            child.off('exit', onExit);
            if (interval) {
                clearInterval(interval);
            }
            resolve(false);
        }, timeoutMs);

        const finish = () => {
            clearTimeout(timeout);
            if (interval) {
                clearInterval(interval);
            }
            child.off('exit', onExit);
            resolve(true);
        };

        const checkShutdown = () => {
            if (childExited && !isProcessGroupActive()) {
                finish();
            }
        };

        const onExit = () => {
            childExited = true;
            checkShutdown();
        };

        if (!childExited) {
            child.once('exit', onExit);
        }

        interval = setInterval(checkShutdown, pollMs);
        beforeWait?.();
        checkShutdown();
    });
}

function isChildProcessGroupActive(child) {
    if (!child.pid) {
        return false;
    }

    try {
        process.kill(-child.pid, 0);
        return true;
    } catch {
        return false;
    }
}

function isStartupComplete(snapshot) {
    const desktopReady =
        snapshot.processes.desktop.status === 'disabled' ||
        snapshot.processes.desktop.status === 'running';
    const runtimeReady =
        snapshot.processes.runtime.status === 'disabled' ||
        snapshot.processes.runtime.status === 'running';

    return (
        snapshot.processes.server.status === 'running' &&
        snapshot.processes.website.status === 'running' &&
        desktopReady &&
        runtimeReady &&
        snapshot.jobs.state === 'ready'
    );
}
