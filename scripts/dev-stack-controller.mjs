import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import readline from 'node:readline';
import {
    assertDevStackPortsAvailable,
    buildManagedOpenClawPlugin,
    cleanupStaleProcesses,
    createDevStackConfig,
    isDesktopMode,
    isRuntimeMode,
    isSuppressedStartupLine,
    startupEventPrefix,
    stripAnsi,
    waitForPort,
    waitForRuntimeReady,
} from './dev-stack-shared.mjs';

export class DevStackController extends EventEmitter {
    constructor({ mode, ports, repositoryRoot }) {
        super();
        this.mode = mode;
        this.ports = ports;
        this.repositoryRoot = repositoryRoot;
        this.processes = new Map();
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
            env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.processes.set(source, child);
        this.attachProcessOutput(source, child);

        child.on('exit', (code, signal) => {
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

        const startupUiEnv = {
            ...process.env,
            TAVERN_STARTUP_UI: '1',
        };

        const hasRuntime = isRuntimeMode(this.mode);
        const serverCommand = 'cd apps/server && TAVERN_EXIT_ON_ORPHAN=1 bun --watch src/index.ts';
        const serverEnv = hasRuntime
            ? {
                  ...startupUiEnv,
                  TAVERN_RUNTIME_URL: 'http://127.0.0.1:4310',
              }
            : startupUiEnv;

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
            await waitForRuntimeReady();
            this.update((snapshot) => {
                snapshot.processes.runtime.status = 'running';
            });
        }

        this.spawnProcess('server', serverCommand, serverEnv);
        await waitForPort(Number(this.ports.serverPort));
        this.update((snapshot) => {
            snapshot.processes.server.status = 'running';
        });

        this.spawnProcess('website', 'cd apps/website && bun x vite --host 127.0.0.1', process.env);
        await waitForPort(Number(this.ports.websitePort));
        this.update((snapshot) => {
            snapshot.processes.website.status = 'running';
        });

        if (isDesktopMode(this.mode)) {
            const desktopEnv = {
                ...process.env,
                TAVERN_DEV_STACK_HAS_RUNTIME: hasRuntime ? '1' : '0',
                TAVERN_OPENCLAW_GATEWAY_PORT: process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789',
                TAVERN_RUNTIME_PORT: '4310',
                TAVERN_SERVER_PORT: String(this.ports.serverPort),
                TAVERN_WEBSITE_PORT: String(this.ports.websitePort),
            };
            this.spawnProcess(
                'desktop',
                "node scripts/run-desktop-dev.mjs --skip-server-cleanup --before-dev-command 'node ../../scripts/noop-command.mjs'",
                desktopEnv
            );
        }

        this.maybeEnterSteadyState();
    }

    async stop(exitCode = 0) {
        if (this.stopPromise) {
            return this.stopPromise;
        }
        this.isStopping = true;

        this.stopPromise = (async () => {
            for (const child of this.processes.values()) {
                child.kill('SIGTERM');
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
            this.emit('exit', exitCode);
        })();

        return this.stopPromise;
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
