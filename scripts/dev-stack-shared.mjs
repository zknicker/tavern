import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { resolveDevPorts } from './dev-ports.mjs';

export const startupEventPrefix = 'TAVERN_STARTUP_EVENT ';
const ansiPattern = /\u001B\[[0-9;?]*[ -/]*[@-~]/gu;

export function isRuntimeMode(mode) {
    return mode === 'web-runtime' || mode === 'desktop-runtime';
}

export function isDesktopMode(mode) {
    return mode === 'desktop' || mode === 'desktop-runtime';
}

export function createDevStackEnvironment({
    baseEnvironment = process.env,
    ports,
    repositoryRoot = process.cwd(),
} = {}) {
    const resolvedPorts = {
        ...resolveDevPorts({ baseEnvironment, repositoryRoot }),
        ...(ports ?? {}),
    };
    const statePaths = createDevStackStatePaths({ baseEnvironment, repositoryRoot });

    return {
        ...baseEnvironment,
        DATABASE_PATH: baseEnvironment.DATABASE_PATH ?? statePaths.databasePath,
        TAVERN_DEV_STACK: baseEnvironment.TAVERN_DEV_STACK ?? '1',
        TAVERN_RUNTIME_PORT: baseEnvironment.TAVERN_RUNTIME_PORT ?? resolvedPorts.runtimePort,
        TAVERN_RUNTIME_ROOT: baseEnvironment.TAVERN_RUNTIME_ROOT ?? statePaths.runtimeRoot,
        // Use the runtime root's persisted token (same file the runtime and CLI
        // resolve) so the server, runtime, and standalone `tavern` CLI runs all
        // authenticate with one stable per-worktree token. Env override wins.
        TAVERN_RUNTIME_TOKEN:
            baseEnvironment.TAVERN_RUNTIME_TOKEN ??
            resolveRuntimeApiTokenFile(
                resolveHomePath(baseEnvironment.TAVERN_RUNTIME_ROOT ?? statePaths.runtimeRoot)
            ),
        TAVERN_SERVER_PORT: baseEnvironment.TAVERN_SERVER_PORT ?? resolvedPorts.serverPort,
        TAVERN_WEBSITE_PORT: baseEnvironment.TAVERN_WEBSITE_PORT ?? resolvedPorts.websitePort,
    };
}

export function createDevStackConfig({
    baseEnvironment = process.env,
    mode,
    ports,
    repositoryRoot,
}) {
    const hasRuntime = isRuntimeMode(mode);
    const isDesktop = isDesktopMode(mode);
    const devEnvironment = createDevStackEnvironment({ baseEnvironment, ports, repositoryRoot });
    const databasePath = resolveHomePath(devEnvironment.DATABASE_PATH);
    const runtimeRoot = resolveHomePath(devEnvironment.TAVERN_RUNTIME_ROOT);
    const runtimeUrl = getRuntimeBaseUrl(devEnvironment);

    return {
        appOrigin: devEnvironment.APP_ORIGIN ?? `http://localhost:${ports.websitePort}`,
        connect: hasRuntime ? 'dev runtime' : 'onboarding/settings',
        databasePath: shortenHomePath(databasePath),
        desktopEnabled: isDesktop,
        jobsDatabasePath: shortenHomePath(deriveJobsDatabasePath(databasePath)),
        runtimeObserve: hasRuntime ? 'live ws' : 'disabled',
        runtimeRoot: shortenHomePath(runtimeRoot),
        runtimeUrl: hasRuntime ? runtimeUrl : 'disabled',
        serverUrl: `http://localhost:${ports.serverPort}`,
        trigger: `@${devEnvironment.ASSISTANT_NAME ?? 'Tavern'}`,
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

export async function waitForRuntimeReady(
    runtimeUrl = getRuntimeBaseUrl(),
    timeoutMs = 10 * 60 * 1000,
    { token } = {}
) {
    const deadline = Date.now() + timeoutMs;
    // The runtime enforces a bearer token on every route except /health, so the
    // readiness probe must authenticate or it 401s forever and the stack hangs.
    const init = token ? { headers: { authorization: `Bearer ${token}` } } : undefined;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${runtimeUrl}/capabilities`, init);
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

    throw new Error(`Timed out waiting for Tavern Runtime readiness at ${runtimeUrl}.`);
}

export function assertDevStackPortsAvailable({ mode, ports, repositoryRoot }) {
    const hasRuntime = isRuntimeMode(mode);
    const devEnvironment = createDevStackEnvironment({ ports, repositoryRoot });
    const definitions = [
        {
            enabled: hasRuntime,
            label: 'runtime',
            port: Number(devEnvironment.TAVERN_RUNTIME_PORT),
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
    const devEnvironment = createDevStackEnvironment({ ports, repositoryRoot });
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
            port: Number(devEnvironment.TAVERN_RUNTIME_PORT),
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

// Mirrors resolveRuntimeApiToken in apps/runtime/src/config.ts: read the token
// from <runtimeRoot>/tavern.json, or create it (base64url 32 bytes, mode 0600,
// unknown keys preserved) so the first dev-stack run and the runtime agree on
// the same persisted token.
function resolveRuntimeApiTokenFile(runtimeRoot) {
    const configPath = path.join(runtimeRoot, 'tavern.json');
    let config = {};
    try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('expected a JSON object');
        }
        config = parsed;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            // Never clobber an operator-edited config file we cannot parse.
            throw new Error(`Tavern Runtime config at ${configPath} is not valid JSON: ${error}`);
        }
        // First run creates the config below.
    }

    const existing = typeof config.token === 'string' ? config.token.trim() : '';
    if (existing) {
        return existing;
    }

    const token = randomBytes(32).toString('base64url');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify({ ...config, token }, null, 2)}\n`, {
        mode: 0o600,
    });
    return token;
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

function createDevStackStatePaths({ baseEnvironment, repositoryRoot }) {
    const stackId =
        baseEnvironment.TAVERN_DEV_STACK_ID ??
        `${path.basename(repositoryRoot)}-${hashString(repositoryRoot).slice(0, 8)}`;
    const appStateRoot = resolveDevStackStateRoot(stackId);

    return {
        databasePath: path.join(appStateRoot, 'tavern.sqlite'),
        runtimeRoot: path.join(appStateRoot, 'runtime'),
    };
}

function resolveDevStackStateRoot(stackId) {
    return path.join(os.homedir(), '.tavern', 'dev', stackId);
}

export function getRuntimeBaseUrl(environment = process.env) {
    return `http://127.0.0.1:${environment.TAVERN_RUNTIME_PORT ?? '18790'}`;
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

function deriveJobsDatabasePath(databasePath) {
    const extension = path.extname(databasePath);

    if (extension.length === 0) {
        return `${databasePath}.jobs.sqlite`;
    }

    const parsed = path.parse(databasePath);
    return path.join(parsed.dir, `${parsed.name}.jobs${extension}`);
}

function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(31, hash) + value.charCodeAt(index);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
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

function isStaleTauriDesktopSidecar(command) {
    return (
        command.includes('/Applications/Tavern.app/Contents/MacOS/tavern-server') &&
        command.includes('--app-origin tauri://localhost')
    );
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
    waitForProcessExit,
};
