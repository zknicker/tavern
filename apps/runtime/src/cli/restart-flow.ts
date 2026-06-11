import type { Brew, BrewResult } from './brew';
import type { RuntimeProbe } from './runtime-probe';
import type { FlowLine } from './update-flow';

export interface RestartFlowDeps {
    brew: Brew;
    /** Monotonic clock in ms. Injected so tests control the 60 s budget. */
    now(): number;
    probe: RuntimeProbe;
    /** Wait `ms` between health polls. Injected so tests advance instantly. */
    sleep(ms: number): Promise<void>;
}

export interface RestartFlowOptions {
    noWait: boolean;
}

export interface RestartFlowResult {
    exitCode: number;
    lines: FlowLine[];
}

const MARK_OK = '✓';
const MARK_FAIL = '✗';
const POLL_INTERVAL_MS = 500;
const POLL_BUDGET_MS = 60_000;

/**
 * Pure-ish restart flow. Restarts the brew service, then (unless --no-wait)
 * polls /health until healthy or the 60 s budget expires. Never reports success
 * without observing health (spec: "tavern restart").
 */
export async function runRestartFlow(
    deps: RestartFlowDeps,
    options: RestartFlowOptions
): Promise<RestartFlowResult> {
    const lines: FlowLine[] = [];

    if (!deps.brew.isAvailable()) {
        lines.push(err(`${MARK_FAIL} Homebrew is required to restart the Runtime.`));
        return { lines, exitCode: 1 };
    }

    const restartResult = deps.brew.servicesRestartRuntime();
    if (restartResult.missing || restartResult.code !== 0) {
        lines.push(err(`${MARK_FAIL} Homebrew failed to restart the Runtime service.`));
        pushCaptured(lines, restartResult);
        return { lines, exitCode: 1 };
    }

    if (options.noWait) {
        lines.push(out('Restart requested. Skipping health wait (--no-wait).'));
        return { lines, exitCode: 0 };
    }

    return pollForHealth(deps, lines);
}

async function pollForHealth(deps: RestartFlowDeps, lines: FlowLine[]): Promise<RestartFlowResult> {
    const deadline = deps.now() + POLL_BUDGET_MS;
    while (deps.now() < deadline) {
        if (await deps.probe.health()) {
            const version = await deps.probe.currentVersion();
            lines.push(out(`${MARK_OK} Runtime healthy · v${version ?? 'unknown'}`));
            return { lines, exitCode: 0 };
        }
        await deps.sleep(POLL_INTERVAL_MS);
    }

    lines.push(err(`${MARK_FAIL} Runtime did not become healthy within 60s of restart.`));
    const info = deps.brew.servicesInfoRuntimeJson();
    pushCaptured(lines, info);
    lines.push(
        err(
            "  ↳ Check the service log: 'brew services info tavern-runtime' and the log path it reports."
        )
    );
    return { lines, exitCode: 1 };
}

function pushCaptured(lines: FlowLine[], result: BrewResult): void {
    const text = [result.stdout, result.stderr]
        .map((part) => part.trimEnd())
        .filter((part) => part.length > 0)
        .join('\n');
    if (text.length > 0) {
        lines.push(err(text));
    }
}

function out(text: string): FlowLine {
    return { text, stream: 'out' };
}

function err(text: string): FlowLine {
    return { text, stream: 'err' };
}
