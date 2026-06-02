import { spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const runtimeBaseUrl = 'http://127.0.0.1:18790';
export const startupEventPrefix = 'TAVERN_STARTUP_EVENT ';
const ansiPattern = /\u001B\[[0-9;?]*[ -/]*[@-~]/gu;
const managedOpenClawPluginPackages = [
    {
        directory: 'tavern-openclaw-messenger',
        packageName: '@zknicker/tavern-openclaw-messenger',
    },
    {
        directory: 'tavern-openclaw-cortex',
        packageName: '@zknicker/tavern-openclaw-cortex',
    },
    {
        directory: 'tavern-openclaw-workspace',
        packageName: '@zknicker/tavern-openclaw-workspace',
    },
];

export function isRuntimeMode(mode) {
    return mode === 'web-runtime' || mode === 'desktop-runtime';
}

export function isDesktopMode(mode) {
    return mode === 'desktop' || mode === 'desktop-runtime';
}

export function createDevStackConfig({ mode, ports, repositoryRoot: _repositoryRoot }) {
    const hasRuntime = isRuntimeMode(mode);
    const isDesktop = isDesktopMode(mode);
    const databasePath = resolveHomePath(process.env.DATABASE_PATH ?? getDefaultDatabasePath());
    const runtimeRoot = resolveHomePath(
        process.env.TAVERN_RUNTIME_ROOT ?? path.join(os.homedir(), '.tavern', 'runtime')
    );

    return {
        appOrigin: process.env.APP_ORIGIN ?? `http://localhost:${ports.websitePort}`,
        connect: hasRuntime ? 'dev runtime' : 'onboarding/settings',
        databasePath: shortenHomePath(databasePath),
        desktopEnabled: isDesktop,
        jobsDatabasePath: shortenHomePath(deriveJobsDatabasePath(databasePath)),
        runtimeObserve: hasRuntime ? 'live ws' : 'disabled',
        runtimeRoot: shortenHomePath(runtimeRoot),
        runtimeUrl: hasRuntime ? runtimeBaseUrl : 'disabled',
        serverUrl: `http://localhost:${ports.serverPort}`,
        trigger: `@${process.env.ASSISTANT_NAME ?? 'Tavern'}`,
        websiteUrl: `http://localhost:${ports.websitePort}`,
        wsUrl: `ws://localhost:${ports.serverPort}/trpc`,
    };
}

export function shortenHomePath(value) {
    const homeDirectory = process.env.HOME ?? os.homedir();
    const compactPath =
        homeDirectory && value.startsWith(homeDirectory)
            ? `~${value.slice(homeDirectory.length)}`
            : value;
    const segments = compactPath.split('/').filter((segment) => segment.length > 0);

    if (segments.length <= 4) {
        return compactPath;
    }

    const prefix = compactPath.startsWith('~/') ? '~' : '';
    const trailingSegments = segments.slice(-2).join('/');

    return `${prefix}/…/${trailingSegments}`;
}

export async function waitForPort(port, host = '127.0.0.1', timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const isOpen = await new Promise((resolve) => {
            const socket = net.connect({ host, port });
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('error', () => {
                socket.destroy();
                resolve(false);
            });
        });

        if (isOpen) {
            return;
        }

        await sleep(100);
    }

    throw new Error(`Timed out waiting for ${host}:${port}.`);
}

export async function waitForRuntimeReady(timeoutMs = 10 * 60 * 1000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${runtimeBaseUrl}/capabilities`);
            if (response.ok) {
                const capabilities = await response.json();
                if (capabilities?.health?.ok === true) {
                    return;
                }
            }
        } catch {
            // Runtime HTTP may not be listening yet.
        }

        await sleep(100);
    }

    throw new Error(`Timed out waiting for Tavern Runtime readiness at ${runtimeBaseUrl}.`);
}

export function buildManagedOpenClawPlugin({ repositoryRoot }) {
    for (const { packageName } of managedOpenClawPluginPackages) {
        const result = spawnSync('bun', ['run', '--filter', packageName, 'build'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
        });

        if (result.status === 0) {
            continue;
        }

        const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        throw new Error(output || `Failed to build ${packageName}.`);
    }
}

export function getManagedOpenClawPluginPackagePaths({ repositoryRoot }) {
    return managedOpenClawPluginPackages.map((pluginPackage) => ({
        ...pluginPackage,
        path: path.join(repositoryRoot, 'packages', pluginPackage.directory),
    }));
}

export function assertDevStackPortsAvailable({ mode, ports, repositoryRoot }) {
    const hasRuntime = isRuntimeMode(mode);
    const definitions = [
        {
            enabled: hasRuntime,
            label: 'runtime',
            port: 18_790,
        },
        {
            enabled: hasRuntime,
            label: 'managed OpenClaw Gateway',
            port: Number.parseInt(process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789', 10),
        },
        {
            enabled: true,
            label: 'server',
            port: Number(ports.serverPort),
        },
        {
            enabled: true,
            label: 'website',
            port: Number(ports.websitePort),
        },
    ];

    const blockers = definitions
        .filter((definition) => definition.enabled)
        .flatMap((definition) =>
            listListeningProcessIds(definition.port).map((pid) => ({
                ...definition,
                command: readProcessCommand(pid),
                cwd: readProcessWorkingDirectory(pid),
                pid,
            }))
        );

    if (blockers.length === 0) {
        return;
    }

    throw new Error(formatPortBlockers(blockers, repositoryRoot));
}

export function cleanupStaleProcesses({
    mode,
    ports,
    processTools = defaultProcessTools,
    repositoryRoot,
}) {
    const hasRuntime = isRuntimeMode(mode);
    const isDesktop = isDesktopMode(mode);
    const managedOpenClawGatewayPort = Number.parseInt(
        process.env.TAVERN_OPENCLAW_GATEWAY_PORT ?? '18789',
        10
    );
    const definitions = [
        {
            commandPattern: 'bun --watch src/index.ts',
            cwd: path.join(repositoryRoot, 'apps', 'server'),
            enabled: true,
            port: Number(ports.serverPort),
        },
        {
            commandPattern: 'vite',
            cwd: path.join(repositoryRoot, 'apps', 'website'),
            enabled: true,
            port: Number(ports.websitePort),
        },
        {
            commandPattern: 'bun --watch src/index.ts',
            cwd: path.join(repositoryRoot, 'apps', 'runtime'),
            enabled: hasRuntime,
            port: 18_790,
        },
        {
            commandPattern: null,
            cwd: null,
            enabled: hasRuntime,
            matches: (pid) =>
                isOpenClawGatewayProcess(
                    processTools.readProcessCommand(pid),
                    managedOpenClawGatewayPort
                ),
            port: managedOpenClawGatewayPort,
        },
        {
            commandPattern: null,
            cwd: null,
            enabled: isDesktop,
            getProcessIds: (pid) =>
                [pid, processTools.readProcessParentId(pid)].filter(
                    (value) => Number.isInteger(value) && value > 1
                ),
            matches: (pid) => isStaleTauriDesktopSidecar(processTools.readProcessCommand(pid)),
            port: 3180,
        },
    ];

    const staleProcessIds = [];

    for (const definition of definitions) {
        if (!definition.enabled) {
            continue;
        }

        const matches = processTools.listListeningProcessIds(definition.port).filter((pid) => {
            const cwd = processTools.readProcessWorkingDirectory(pid);
            const command = processTools.readProcessCommand(pid);
            if (definition.matches) {
                return definition.matches(pid);
            }
            return cwd === definition.cwd && command.includes(definition.commandPattern);
        });

        staleProcessIds.push(
            ...matches.flatMap((pid) =>
                definition.getProcessIds ? definition.getProcessIds(pid) : pid
            )
        );
    }

    const uniqueProcessIds = [...new Set(staleProcessIds)];

    if (hasRuntime && uniqueProcessIds.length > 0) {
        processTools.stopGlobalOpenClawLaunchAgent();
    }

    for (const pid of uniqueProcessIds) {
        processTools.killProcess(pid, 'SIGTERM');
    }

    processTools.waitForProcessExit(uniqueProcessIds);

    return uniqueProcessIds.length;
}

export function formatPortBlockers(blockers, repositoryRoot) {
    const lines = blockers.map((blocker) => {
        const cwd = blocker.cwd
            ? shortenRepositoryPath(blocker.cwd, repositoryRoot)
            : 'unknown cwd';
        const command = blocker.command || 'unknown command';
        return `${blocker.label} port ${blocker.port} is already in use by PID ${blocker.pid}: ${command} (${cwd})`;
    });

    return `Required dev port unavailable:\n${lines.join('\n')}`;
}

export function isSuppressedStartupLine(source, line) {
    if (source === 'runtime') {
        return (
            /Central DB initialized/.test(line) ||
            /Central DB ready/.test(line) ||
            /Delivery polls started/.test(line) ||
            /Host sweep started/.test(line) ||
            /CLI channel listening/.test(line) ||
            /Channel adapter started/.test(line) ||
            /Scheduler loop started/.test(line) ||
            /IPC watcher started/.test(line) ||
            /Tavern Runtime running/.test(line)
        );
    }

    if (source === 'website') {
        return (
            /^\s*VITE v/u.test(line) ||
            /Re-optimizing dependencies because lockfile has changed/u.test(line) ||
            /➜\s+Local:/u.test(line) ||
            /➜\s+Network:/u.test(line)
        );
    }

    if (source === 'desktop') {
        return (
            /^\s*\[\d+ms\]\s+bundle/u.test(line) ||
            /^\s*\[\d+ms\]\s+compile/u.test(line) ||
            /Running BeforeDevCommand/u.test(line)
        );
    }

    return false;
}

export function stripAnsi(value) {
    return value.replace(ansiPattern, '');
}

function resolveHomePath(value) {
    if (value === '~') {
        return os.homedir();
    }
    if (value.startsWith('~/')) {
        return path.join(os.homedir(), value.slice(2));
    }
    return path.resolve(value);
}

function shortenRepositoryPath(value, repositoryRoot) {
    if (value === repositoryRoot) {
        return '.';
    }
    if (value.startsWith(`${repositoryRoot}${path.sep}`)) {
        return `.${path.sep}${path.relative(repositoryRoot, value)}`;
    }
    return shortenHomePath(value);
}

function getDefaultDatabasePath() {
    return path.join(os.homedir(), '.tavern', 'tavern.sqlite');
}

function deriveJobsDatabasePath(databasePath) {
    const extension = path.extname(databasePath);

    if (extension.length === 0) {
        return `${databasePath}.jobs.sqlite`;
    }

    const parsed = path.parse(databasePath);
    return path.join(parsed.dir, `${parsed.name}.jobs${extension}`);
}

function sleep(durationMs) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function listListeningProcessIds(port) {
    const result = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
        encoding: 'utf8',
    });

    if (typeof result.stdout !== 'string' || result.stdout.trim().length === 0) {
        return [];
    }

    return result.stdout
        .split(/\s+/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value));
}

function readProcessWorkingDirectory(pid) {
    const result = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
        encoding: 'utf8',
    });

    if (typeof result.stdout !== 'string') {
        return null;
    }

    return (
        result.stdout
            .split('\n')
            .find((line) => line.startsWith('n'))
            ?.slice(1) ?? null
    );
}

function readProcessCommand(pid) {
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
        encoding: 'utf8',
    });

    return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function readProcessParentId(pid) {
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'ppid='], {
        encoding: 'utf8',
    });
    const value = Number.parseInt(
        typeof result.stdout === 'string' ? result.stdout.trim() : '',
        10
    );

    return Number.isInteger(value) ? value : null;
}

function isOpenClawGatewayProcess(command, port) {
    return (
        command.includes('openclaw') &&
        command.includes('gateway') &&
        command.includes(String(port))
    );
}

function isStaleTauriDesktopSidecar(command) {
    return (
        command.includes('/Applications/Tavern.app/Contents/MacOS/tavern-server') &&
        command.includes('--app-origin tauri://localhost')
    );
}

function stopGlobalOpenClawLaunchAgent() {
    spawnSync('launchctl', ['remove', 'ai.openclaw.gateway'], {
        stdio: 'ignore',
    });
}

function waitForProcessExit(processIds) {
    if (processIds.length === 0) {
        return;
    }

    const deadline = Date.now() + 3000;
    let escalated = false;

    while (Date.now() < deadline) {
        const remaining = processIds.filter((pid) => {
            try {
                process.kill(pid, 0);
                return true;
            } catch {
                return false;
            }
        });

        if (remaining.length === 0) {
            return;
        }

        if (!escalated) {
            for (const pid of remaining) {
                process.kill(pid, 'SIGKILL');
            }
            escalated = true;
        }

        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
}

const defaultProcessTools = {
    killProcess: (pid, signal) => process.kill(pid, signal),
    listListeningProcessIds,
    readProcessCommand,
    readProcessParentId,
    readProcessWorkingDirectory,
    stopGlobalOpenClawLaunchAgent,
    waitForProcessExit,
};
