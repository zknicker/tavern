import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { brew } from './brew';
import { runRestartFlow } from './restart-flow';
import { runtimeProbe } from './runtime-probe';
import { printFlowLines } from './ui';
import { runUpdateFlow } from './update-flow';

interface UpdateArgs {
    restart: boolean;
    verbose: boolean;
}

interface RestartArgs {
    noWait: boolean;
}

/** Resolve the brew-installed Grotto binary, e.g. `/opt/homebrew/bin/grotto`. */
function brewGrottoBin(): string {
    const prefix = spawnSync('brew', ['--prefix'], {
        encoding: 'utf8',
    }).stdout?.trim();
    return prefix ? `${prefix}/bin/grotto` : 'grotto';
}

/**
 * Read the staged binary's version by spawning the brew-installed binary. The
 * in-process version is whatever binary the user invoked, which may be the old
 * one, so we must ask the freshly staged binary directly.
 */
async function stagedVersion(): Promise<string> {
    const result = spawnSync(brewGrottoBin(), ['--version'], {
        encoding: 'utf8',
    });
    return result.stdout?.trim() || 'unknown';
}

/** Best-effort engine pre-stage, mirroring apps/runtime/src/tavern/update.ts. */
async function stageEngine(): Promise<boolean> {
    const result = spawnSync(brewGrottoBin(), ['engine', 'install'], {
        encoding: 'utf8',
        env: process.env,
    });
    return !result.error && result.status === 0;
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
        {
            restart: args.restart,
            verbose: args.verbose,
            onProgress: (line) => printFlowLines([line]),
        }
    );
    printFlowLines(result.lines.slice(result.progressLineCount));

    const shouldRestart =
        result.shouldRestart ||
        (result.exitCode === 0 && result.needsCutover && (await confirmRestart()));
    if (shouldRestart) {
        return await runRestartCommand({ noWait: false });
    }
    return result.exitCode;
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
    printFlowLines(result.lines);
    return result.exitCode;
}
