import type { Brew, BrewResult } from './brew';
import type { RuntimeProbe } from './runtime-probe';

export interface UpdateFlowDeps {
    brew: Brew;
    probe: RuntimeProbe;
    /** Version of the staged on-disk binary (`grotto --version`). */
    stagedVersion(): Promise<string>;
    /** Best-effort engine pre-stage; resolves to true on success. */
    stageEngine(): Promise<boolean>;
}

export interface UpdateFlowOptions {
    onProgress?(line: FlowLine): void;
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
    /**
     * True when the verdict was "staged but the runtime is still on the old
     * version" — the caller may offer an interactive cutover. Set explicitly so
     * callers never sniff line text (the Phase 0 seam).
     */
    needsCutover: boolean;
    /** Number of leading lines already emitted through `onProgress`. */
    progressLineCount: number;
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
    let progressLineCount = 0;

    const progress = (text: string) => {
        const line = out(text);
        lines.push(line);
        progressLineCount += 1;
        options.onProgress?.(line);
    };

    progress('Checking Homebrew...');
    if (!deps.brew.isAvailable()) {
        lines.push(err(`${MARK_FAIL} Homebrew is required to update the Runtime.`));
        return result(lines, progressLineCount, 1, false, false);
    }

    progress('Checking Grotto Runtime formula...');
    const alreadyCurrent = !deps.brew.isRuntimeOutdated();

    progress('Updating Homebrew metadata...');
    const updateResult = deps.brew.update();
    let upgradeFailed = brewFailed(updateResult) ? updateResult : null;
    if (!upgradeFailed) {
        progress('Staging Grotto Runtime package...');
        upgradeFailed = maybeFailed(deps.brew.upgradeRuntime());
    }
    if (upgradeFailed) {
        lines.push(err(`${MARK_FAIL} Homebrew failed to stage the Runtime upgrade.`));
        pushCaptured(lines, upgradeFailed, true);
        return result(lines, progressLineCount, 1, false, false);
    }

    if (options.verbose) {
        pushCaptured(lines, updateResult, false);
    }

    // Engine pre-stage is best-effort; a failure only warns (restart-time setup
    // is the safety net), mirroring apps/runtime/src/tavern/update.ts.
    progress('Pre-staging agent engine...');
    const engineStaged = await deps.stageEngine();
    if (!engineStaged) {
        lines.push(out('  Note: agent engine pre-stage failed; the restart will install it.'));
    }

    progress('Reading staged Runtime version...');
    const staged = await deps.stagedVersion();
    if (alreadyCurrent) {
        lines.push(out(`${MARK_OK} Already up to date (v${staged})`));
    }

    progress('Checking running Runtime version...');
    const running = await deps.probe.currentVersion();
    return finishUpdate(lines, progressLineCount, { running, staged }, options);
}

function finishUpdate(
    lines: FlowLine[],
    progressLineCount: number,
    versions: { running: string | null; staged: string },
    options: UpdateFlowOptions
): UpdateFlowResult {
    const { running, staged } = versions;

    if (running === null) {
        lines.push(
            out(
                `${MARK_OK} Staged v${staged}. Runtime is not running — start it with 'brew services start grotto-runtime'.`
            )
        );
        return result(lines, progressLineCount, 0, false, false);
    }

    if (running === staged) {
        lines.push(out(`${MARK_OK} Runtime is up to date and running v${staged}.`));
        return result(lines, progressLineCount, 0, false, false);
    }

    lines.push(out(`${MARK_OK} Staged v${staged} — runtime is still running v${running}.`));
    if (options.restart) {
        return result(lines, progressLineCount, 0, true, true);
    }
    lines.push(out("Run 'grotto restart' to cut over."));
    return result(lines, progressLineCount, 0, false, true);
}

function result(
    lines: FlowLine[],
    progressLineCount: number,
    exitCode: number,
    shouldRestart: boolean,
    needsCutover: boolean
): UpdateFlowResult {
    return { exitCode, lines, needsCutover, progressLineCount, shouldRestart };
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
