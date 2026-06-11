import type { Brew, BrewResult } from './brew';
import type { RuntimeProbe } from './runtime-probe';

export interface UpdateFlowDeps {
    brew: Brew;
    probe: RuntimeProbe;
    /** Version of the staged on-disk binary (`tavern --version`). */
    stagedVersion(): Promise<string>;
    /** Best-effort engine pre-stage; resolves to true on success. */
    stageEngine(): Promise<boolean>;
}

export interface UpdateFlowOptions {
    restart: boolean;
    verbose: boolean;
}

export interface FlowLine {
    /** Where the line is written. */
    stream: 'out' | 'err';
    text: string;
}

export interface UpdateFlowResult {
    exitCode: number;
    lines: FlowLine[];
    /** True when the caller should run the restart flow (--restart or TTY confirm). */
    shouldRestart: boolean;
}

const MARK_OK = '✓';
const MARK_FAIL = '✗';

/**
 * Pure-ish update flow. Produces the lines to print, the exit code, and whether
 * a restart should follow. All process/network/version I/O is injected so the
 * matrix is unit-testable without spawning brew or hitting the runtime.
 */
export async function runUpdateFlow(
    deps: UpdateFlowDeps,
    options: UpdateFlowOptions
): Promise<UpdateFlowResult> {
    const lines: FlowLine[] = [];

    if (!deps.brew.isAvailable()) {
        lines.push(err(`${MARK_FAIL} Homebrew is required to update the Runtime.`));
        return { lines, exitCode: 1, shouldRestart: false };
    }

    const alreadyCurrent = !deps.brew.isRuntimeOutdated();

    const updateResult = deps.brew.update();
    const upgradeFailed = brewFailed(updateResult)
        ? updateResult
        : maybeFailed(deps.brew.upgradeRuntime());
    if (upgradeFailed) {
        lines.push(err(`${MARK_FAIL} Homebrew failed to stage the Runtime upgrade.`));
        pushCaptured(lines, upgradeFailed, true);
        return { lines, exitCode: 1, shouldRestart: false };
    }

    if (options.verbose) {
        pushCaptured(lines, updateResult, false);
    }

    // Engine pre-stage is best-effort; a failure only warns (restart-time setup
    // is the safety net), mirroring apps/runtime/src/tavern/update.ts.
    const engineStaged = await deps.stageEngine();
    if (!engineStaged) {
        lines.push(out('  Note: agent engine pre-stage failed; the restart will install it.'));
    }

    const staged = await deps.stagedVersion();
    if (alreadyCurrent) {
        lines.push(out(`${MARK_OK} Already up to date (v${staged})`));
    }

    const running = await deps.probe.currentVersion();
    return finishUpdate(lines, { running, staged }, options);
}

function finishUpdate(
    lines: FlowLine[],
    versions: { running: string | null; staged: string },
    options: UpdateFlowOptions
): UpdateFlowResult {
    const { running, staged } = versions;

    if (running === null) {
        lines.push(
            out(
                `${MARK_OK} Staged v${staged}. Runtime is not running — start it with 'brew services start tavern-runtime'.`
            )
        );
        return { lines, exitCode: 0, shouldRestart: false };
    }

    if (running === staged) {
        lines.push(out(`${MARK_OK} Runtime is up to date and running v${staged}.`));
        return { lines, exitCode: 0, shouldRestart: false };
    }

    lines.push(out(`${MARK_OK} Staged v${staged} — runtime is still running v${running}.`));
    if (options.restart) {
        return { lines, exitCode: 0, shouldRestart: true };
    }
    lines.push(out("Run 'tavern restart' to cut over."));
    return { lines, exitCode: 0, shouldRestart: false };
}

function brewFailed(result: BrewResult): boolean {
    return result.missing || result.code !== 0;
}

function maybeFailed(result: BrewResult): BrewResult | null {
    return brewFailed(result) ? result : null;
}

function pushCaptured(lines: FlowLine[], result: BrewResult, asError: boolean): void {
    const text = [result.stdout, result.stderr]
        .map((part) => part.trimEnd())
        .filter((part) => part.length > 0)
        .join('\n');
    if (text.length > 0) {
        lines.push(asError ? err(text) : out(text));
    }
}

function out(text: string): FlowLine {
    return { text, stream: 'out' };
}

function err(text: string): FlowLine {
    return { text, stream: 'err' };
}
