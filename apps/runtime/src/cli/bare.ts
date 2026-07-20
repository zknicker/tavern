import runtimePackage from '../../package.json';
import { LISTED_COMMANDS } from './registry';
import { localRuntimeUrl, probeRunningVersion } from './runtime-probe';
import { banner, rows, type StatusTone, statusDot, ui } from './ui';

/** A computed bare-status line: the dot tone and its text. */
export interface BareStatus {
    text: string;
    tone: StatusTone;
}

/**
 * Compute the bare `grotto` status line from the running version (probe result)
 * and the invoked binary's version. Pure so tests cover the three verdicts.
 *
 * - reachable, versions match → healthy
 * - reachable, binary newer   → degraded (staged, restart hint)
 * - unreachable               → off
 */
export function computeBareStatus(running: string | null, binary: string, url: string): BareStatus {
    if (running === null) {
        return {
            tone: 'off',
            text: `Runtime not running · 'brew services start grotto-runtime'`,
        };
    }
    if (running === binary) {
        return { tone: 'healthy', text: `Runtime v${running} · healthy · ${url}` };
    }
    return {
        tone: 'degraded',
        text: `Runtime v${running} · binary v${binary} staged — run 'grotto restart'`,
    };
}

/**
 * Bare `grotto`: banner, one status line, the command list, and a help pointer.
 * Probes the local runtime with a ~750 ms timeout. Always exits 0 and never
 * starts the server.
 */
export async function runBareTavern(): Promise<number> {
    const running = await probeRunningVersion();
    const status = computeBareStatus(running, runtimePackage.version, localRuntimeUrl());

    const out = process.stdout;
    out.write(`${banner()}\n`);
    out.write(`${statusDot(status.tone, out)} ${status.text}\n\n`);

    const commandRows = rows(
        LISTED_COMMANDS.map((command) => ({ left: command.name, right: command.summary })),
        '  '
    );
    out.write(`${commandRows}\n\n`);
    out.write(`${ui.dim("Run 'grotto help <command>' for details.", out)}\n`);
    return 0;
}
