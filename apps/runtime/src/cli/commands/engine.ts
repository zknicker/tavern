import fs from 'node:fs/promises';
import path from 'node:path';
import { AGENT_HOME, readConfigValue } from '../../config.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { writeJson } from '../ui.ts';
import { type EngineStatusReport, renderEngineStatus } from './engine-render.ts';

/** Injectable side effects so tests run subcommands against fixtures. */
export interface EngineDeps {
    install(): Promise<{ detail: string; tier: 'package' }>;
    listInstalls(): string[];
    log(text: string): void;
    removeInstall(dirName: string): Promise<void>;
    status(): EngineStatusReport;
    write(text: string): void;
}

function defaultDeps(): EngineDeps {
    return {
        status: readEngineStatus,
        install: async () => {
            await fs.mkdir(AGENT_HOME, { recursive: true });
            return {
                detail: 'Agent package dependencies are installed by bun',
                tier: 'package',
            };
        },
        listInstalls: () => [],
        removeInstall: async (dirName) =>
            await fs.rm(path.join(AGENT_HOME, dirName), { force: true, recursive: true }),
        log: (text) => console.log(text),
        write: (text) => process.stdout.write(text),
    };
}

const statusSub: SubCommand = {
    name: 'status',
    summary: 'Show the local agent engine status',
    usage: 'grotto engine status [--json]',
    flags: [{ name: '--json', description: 'Emit one JSON document' }],
    positionals: [],
    examples: ['grotto engine status', 'grotto engine status --json'],
    run: (args) => runStatus(args),
};

const installSub: SubCommand = {
    name: 'install',
    summary: 'Prepare the local agent home',
    usage: 'grotto engine install',
    flags: [],
    positionals: [],
    examples: ['grotto engine install'],
    run: (args) => runInstall(args),
};

const cleanSub: SubCommand = {
    name: 'clean',
    summary: 'Remove local agent engine install artifacts',
    usage: 'grotto engine clean [--all]',
    flags: [
        {
            name: '--all',
            description: 'Accepted for compatibility; all local artifacts are removed',
        },
    ],
    positionals: [],
    examples: ['grotto engine clean'],
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
    const resolved = await deps.install();
    deps.log(`Agent engine ready: ${resolved.detail} (${resolved.tier})`);
    return 0;
}

async function runClean(_args: ParsedArgs, overrides?: Partial<EngineDeps>): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const removed: string[] = [];

    for (const dirName of deps.listInstalls()) {
        await deps.removeInstall(dirName);
        removed.push(dirName);
    }

    deps.log(
        removed.length === 0
            ? 'Nothing to clean.'
            : `Removed engine artifacts: ${removed.join(', ')}`
    );
    return 0;
}

/** Build the engine status report; key order is the `--json` contract. */
function readEngineStatus(): EngineStatusReport {
    const provider = readConfigValue('TAVERN_AGENT_PROVIDER');
    return {
        agentHome: AGENT_HOME,
        installedPins: [],
        mode: 'local-ai-sdk',
        provider,
        resolved: {
            detail: 'Agent and AI SDK package dependencies',
            tier: 'package',
        },
    };
}

// Test seams: invoke a subcommand with injected deps.
export const __test = { runStatus, runInstall, runClean };
