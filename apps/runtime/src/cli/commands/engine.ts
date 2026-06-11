import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureHermesBinary, isSystemInstallAllowed } from '../../hermes/bootstrap.ts';
import {
    enginePinDirName,
    engineRoot,
    listEnginePinDirs,
    readEngineMarker,
    resolveHermesPin,
} from '../../hermes/engine.ts';
import { resolveEngineStatus } from '../../hermes/engine-resolution.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { writeJson } from '../ui.ts';
import { type EngineStatusReport, renderEngineStatus } from './engine-render.ts';

/** Injectable side effects so tests run subcommands against fixtures. */
export interface EngineDeps {
    /** Dir name of the current pin's install, kept by `clean` unless --all. */
    currentPinDir(): string;
    install(onLine: (line: string) => void): Promise<{ binaryPath: string; tier: string }>;
    /** All installed pin dir names under the engine root. */
    listInstalls(): string[];
    log(text: string): void;
    removeInstall(dirName: string): Promise<void>;
    status(): EngineStatusReport;
    write(text: string): void;
}

function defaultDeps(): EngineDeps {
    return {
        status: readEngineStatus,
        install: async (onLine) =>
            await ensureHermesBinary({ forceInstall: true, onInstallerLine: onLine }),
        listInstalls: listEnginePinDirs,
        currentPinDir: () => enginePinDirName(resolveHermesPin()),
        removeInstall: (dirName) =>
            fs.rm(path.join(engineRoot(), dirName), { force: true, recursive: true }),
        log: (text) => console.log(text),
        write: (text) => process.stdout.write(text),
    };
}

const statusSub: SubCommand = {
    name: 'status',
    summary: 'Show the engine pin, root, resolution, and installs',
    usage: 'tavern engine status [--json]',
    flags: [{ name: '--json', description: 'Emit one JSON document' }],
    positionals: [],
    examples: ['tavern engine status', 'tavern engine status --json'],
    run: (args) => runStatus(args),
};

const installSub: SubCommand = {
    name: 'install',
    summary: 'Install the managed agent engine for the current pin',
    usage: 'tavern engine install',
    flags: [],
    positionals: [],
    examples: ['tavern engine install'],
    run: (args) => runInstall(args),
};

const cleanSub: SubCommand = {
    name: 'clean',
    summary: 'Remove engine installs, keeping the current pin unless --all',
    usage: 'tavern engine clean [--all]',
    flags: [{ name: '--all', description: 'Remove every installed pin' }],
    positionals: [],
    examples: ['tavern engine clean', 'tavern engine clean --all'],
    run: (args) => runClean(args),
};

/** Every engine subcommand, in display order. */
export const ENGINE_SUBCOMMANDS: SubCommand[] = [statusSub, installSub, cleanSub];

async function runStatus(args: ParsedArgs, overrides?: Partial<EngineDeps>): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const status = deps.status();
    if (args.flags['--json']) {
        writeJson(status, deps.write);
        return 0;
    }
    deps.write(`${renderEngineStatus(status)}\n`);
    return 0;
}

async function runInstall(_args: ParsedArgs, overrides?: Partial<EngineDeps>): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const resolved = await deps.install((line) => deps.log(line));
    deps.log(`Agent engine ready: ${resolved.binaryPath} (${resolved.tier})`);
    return 0;
}

async function runClean(args: ParsedArgs, overrides?: Partial<EngineDeps>): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const keep = args.flags['--all'] ? null : deps.currentPinDir();
    const removed: string[] = [];

    for (const dirName of deps.listInstalls()) {
        if (keep && dirName === keep) {
            continue;
        }
        await deps.removeInstall(dirName);
        removed.push(dirName);
    }

    if (removed.length === 0) {
        deps.log('Nothing to clean.');
        return 0;
    }
    deps.log(`Removed engine installs: ${removed.join(', ')}`);
    if (keep) {
        deps.log(`Kept current pin: ${keep}`);
    }
    return 0;
}

/** Build the engine status report; key order is the `--json` contract. */
function readEngineStatus(): EngineStatusReport {
    const pin = resolveHermesPin();
    return {
        engineRoot: engineRoot(),
        installedPins: listEnginePinDirs(),
        marker: readEngineMarker(pin),
        pin,
        resolved: resolveEngineStatus(),
        systemAllowed: isSystemInstallAllowed(),
    };
}

// Test seams: invoke a subcommand with injected deps.
export const __test = { runStatus, runInstall, runClean };
