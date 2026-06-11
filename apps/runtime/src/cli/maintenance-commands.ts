import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { brew } from './brew';
import { runRestartFlow } from './restart-flow';
import { runtimeProbe } from './runtime-probe';
import { type FlowLine, runUpdateFlow } from './update-flow';

interface UpdateArgs {
    restart: boolean;
    verbose: boolean;
}

interface RestartArgs {
    noWait: boolean;
}

/** Resolve the brew-installed tavern binary, e.g. `/opt/homebrew/bin/tavern`. */
function brewTavernBin(): string {
    const prefix = spawnSync('brew', ['--prefix'], { encoding: 'utf8' }).stdout?.trim();
    return prefix ? `${prefix}/bin/tavern` : 'tavern';
}

/**
 * Read the staged binary's version by spawning the brew-installed binary. The
 * in-process version is whatever binary the user invoked, which may be the old
 * one, so we must ask the freshly staged binary directly.
 */
async function stagedVersion(): Promise<string> {
    const result = spawnSync(brewTavernBin(), ['--version'], { encoding: 'utf8' });
    return result.stdout?.trim() || 'unknown';
}

/** Best-effort engine pre-stage, mirroring apps/runtime/src/tavern/update.ts. */
async function stageEngine(): Promise<boolean> {
    const result = spawnSync(brewTavernBin(), ['engine', 'install'], {
        encoding: 'utf8',
        env: process.env,
    });
    return !result.error && result.status === 0;
}

function printLines(lines: FlowLine[]): void {
    for (const line of lines) {
        if (line.stream === 'err') {
            console.error(line.text);
        } else {
            console.log(line.text);
        }
    }
}

async function confirmRestart(): Promise<boolean> {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) {
        return false;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question('Restart now? [y/N] ');
        return /^y(es)?$/i.test(answer.trim());
    } finally {
        rl.close();
    }
}

export async function runUpdateCommand(args: UpdateArgs): Promise<number> {
    const result = await runUpdateFlow(
        { brew, probe: runtimeProbe, stagedVersion, stageEngine },
        { restart: args.restart, verbose: args.verbose }
    );
    printLines(result.lines);

    const shouldRestart =
        result.shouldRestart ||
        (result.exitCode === 0 && needsCutover(result.lines) && (await confirmRestart()));
    if (shouldRestart) {
        return await runRestartCommand({ noWait: false });
    }
    return result.exitCode;
}

/** True when the verdict was "staged but still running old" (offer a cutover). */
function needsCutover(lines: FlowLine[]): boolean {
    return lines.some((line) => line.text.includes('runtime is still running'));
}

export async function runRestartCommand(args: RestartArgs): Promise<number> {
    const result = await runRestartFlow(
        {
            brew,
            probe: runtimeProbe,
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
            now: () => Date.now(),
        },
        { noWait: args.noWait }
    );
    printLines(result.lines);
    return result.exitCode;
}
