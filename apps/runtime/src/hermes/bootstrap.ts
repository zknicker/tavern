import { spawn, spawnSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { log } from '../log';
import { withEngineInstallLock } from './bootstrap-lock';
import {
    engineBinaryPath,
    engineInstallDir,
    engineRoot,
    type HermesEnginePin,
    hermesInstallerUrl,
    readEngineMarker,
    resolveHermesPin,
    writeEngineMarker,
} from './engine';
import { managedHermesSetupError } from './errors';
import { resolveRuntimeAssetsRoot } from './llm-wiki';

const installerTimeoutMs = 20 * 60 * 1000;

export type InstallerRunner = (input: {
    args: string[];
    onLine: (line: string) => void;
    scriptPath: string;
}) => Promise<void>;

export interface EnsureHermesBinaryOptions {
    forceInstall?: boolean;
    onInstallerLine?: (line: string) => void;
    onPhase?: (phase: 'installed' | 'installing') => void;
    runInstaller?: InstallerRunner;
}

export type HermesBinaryTier = 'configured' | 'managed' | 'system';

export interface ResolvedHermesBinary {
    binaryPath: string;
    tier: HermesBinaryTier;
}

/**
 * Resolution order: explicit TAVERN_HERMES_BIN, the Tavern-managed engine
 * install for the resolved pin, then existing system installs. Returns null
 * when nothing is installed; bootstrap is the caller's fallback.
 */
export function resolveInstalledHermesBinary(): ResolvedHermesBinary | null {
    const configured = readConfigValue('TAVERN_HERMES_BIN');
    if (configured) {
        const resolved = resolveConfiguredPath(configured);
        if (!isExecutableFile(resolved)) {
            throw managedHermesSetupError(
                `The configured agent engine binary is not executable: ${resolved}`
            );
        }
        return { binaryPath: resolved, tier: 'configured' };
    }

    const pin = resolveHermesPin();
    const managedBinary = engineBinaryPath(pin);
    if (readEngineMarker(pin) && isExecutableFile(managedBinary)) {
        return { binaryPath: managedBinary, tier: 'managed' };
    }

    const homeDir = process.env.HOME || os.homedir();
    for (const candidate of [
        path.join(homeDir, '.local', 'bin', 'hermes'),
        '/opt/homebrew/bin/hermes',
        '/usr/local/bin/hermes',
    ]) {
        if (isExecutableFile(candidate)) {
            return { binaryPath: candidate, tier: 'system' };
        }
    }

    const pathCandidate = findExecutableOnPath('hermes');
    return pathCandidate ? { binaryPath: pathCandidate, tier: 'system' } : null;
}

export async function ensureHermesBinary(
    options: EnsureHermesBinaryOptions = {}
): Promise<ResolvedHermesBinary> {
    const existing = resolveInstalledHermesBinary();
    if (existing && !(options.forceInstall && existing.tier === 'system')) {
        return existing;
    }

    if (!(options.forceInstall || isAutoInstallEnabled())) {
        throw managedHermesSetupError(
            'The agent engine is not installed and automatic setup is disabled ' +
                '(TAVERN_HERMES_AUTO_INSTALL=0). Set TAVERN_HERMES_BIN to an existing install ' +
                'or run "tavern engine install".'
        );
    }

    await bootstrapManagedHermes(options);

    const resolved = resolveInstalledHermesBinary();
    if (!resolved) {
        throw managedHermesSetupError(
            'The agent engine install finished but no usable binary was found. ' +
                'Run "tavern engine status" for details.'
        );
    }
    return resolved;
}

export async function bootstrapManagedHermes(options: EnsureHermesBinaryOptions = {}) {
    const pin = resolveHermesPin();
    assertGitAvailable();
    const installer = await resolveInstallerScript();

    await withEngineInstallLock(engineRoot(), async () => {
        // Another process may have finished the install while we waited.
        if (readEngineMarker(pin) && isExecutableFile(engineBinaryPath(pin))) {
            return;
        }

        const args = buildHermesInstallArgs({ hermesHome: HERMES_HOME, pin });
        const onLine =
            options.onInstallerLine ??
            ((line: string) => log.info('Agent engine installer', { line }));
        options.onPhase?.('installing');
        log.info('Installing the managed agent engine', {
            installDir: engineInstallDir(pin),
            ref: pin.ref,
            source: installer.source,
        });

        const run = options.runInstaller ?? runInstallerProcess;
        await run({ args, onLine, scriptPath: installer.scriptPath });

        if (!isExecutableFile(engineBinaryPath(pin))) {
            throw managedHermesSetupError(
                'Tavern could not set up the agent engine automatically. The installer finished ' +
                    `but ${engineBinaryPath(pin)} is not executable. Check your network connection ` +
                    'and that git is installed, or set TAVERN_HERMES_BIN to an existing install.'
            );
        }

        writeEngineMarker(pin, {
            binaryPath: engineBinaryPath(pin),
            installedAt: new Date().toISOString(),
            installerSource: installer.source,
            ref: pin.ref,
        });
        options.onPhase?.('installed');
    });
}

export function buildHermesInstallArgs(input: { hermesHome: string; pin: HermesEnginePin }) {
    const refArgs =
        input.pin.kind === 'commit' ? ['--commit', input.pin.ref] : ['--branch', input.pin.ref];
    return [
        '--dir',
        engineInstallDir(input.pin),
        '--hermes-home',
        input.hermesHome,
        ...refArgs,
        '--non-interactive',
        '--skip-setup',
        '--no-skills',
        '--skip-browser',
    ];
}

function isAutoInstallEnabled() {
    const configured = readConfigValue('TAVERN_HERMES_AUTO_INSTALL');
    return !(configured === '0' || configured === 'false');
}

function assertGitAvailable() {
    const result = spawnSync('git', ['--version'], { timeout: 10_000 });
    if (result.status !== 0) {
        throw managedHermesSetupError(
            'Setting up the agent engine requires git, which was not found. Install the macOS ' +
                'command line tools (xcode-select --install) and retry.'
        );
    }
}

async function resolveInstallerScript(): Promise<{
    scriptPath: string;
    source: 'bundled-asset' | 'remote-download';
}> {
    const bundled = path.join(resolveRuntimeAssetsRoot(), 'hermes', 'installer', 'install.sh');
    if (isReadableFile(bundled)) {
        return { scriptPath: bundled, source: 'bundled-asset' };
    }

    const downloaded = path.join(engineRoot(), 'installer', 'install.sh');
    const response = await fetch(hermesInstallerUrl).catch((err: unknown) => {
        throw managedHermesSetupError(
            `Tavern could not download the agent engine installer (${hermesInstallerUrl}): ` +
                `${err instanceof Error ? err.message : String(err)}`
        );
    });
    if (!response.ok) {
        throw managedHermesSetupError(
            `Tavern could not download the agent engine installer (${hermesInstallerUrl}): ` +
                `HTTP ${response.status}.`
        );
    }
    await fs.mkdir(path.dirname(downloaded), { recursive: true });
    await fs.writeFile(downloaded, await response.text(), { mode: 0o755 });
    return { scriptPath: downloaded, source: 'remote-download' };
}

function runInstallerProcess(input: {
    args: string[];
    onLine: (line: string) => void;
    scriptPath: string;
}): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('bash', [input.scriptPath, ...input.args], {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            reject(
                managedHermesSetupError(
                    `The agent engine installer timed out after ${installerTimeoutMs / 60_000} minutes.`
                )
            );
        }, installerTimeoutMs);

        forwardLines(child.stdout, input.onLine);
        forwardLines(child.stderr, input.onLine);

        child.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        child.once('exit', (code, signal) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                managedHermesSetupError(
                    `The agent engine installer exited with ${signal ?? `code ${code}`}.`
                )
            );
        });
    });
}

function forwardLines(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void) {
    if (!stream) {
        return;
    }
    let buffered = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
        buffered += chunk;
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';
        for (const line of lines) {
            if (line.trim()) {
                onLine(line);
            }
        }
    });
    stream.on('end', () => {
        if (buffered.trim()) {
            onLine(buffered);
        }
    });
}

function isExecutableFile(filePath: string) {
    try {
        fsSync.accessSync(filePath, fsSync.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function isReadableFile(filePath: string) {
    try {
        fsSync.accessSync(filePath, fsSync.constants.R_OK);
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
