import { spawnSync } from 'node:child_process';

export interface BrewResult {
    /** Process exit code, or null when the process never spawned. */
    code: number | null;
    /** True when the `brew` binary could not be spawned at all. */
    missing: boolean;
    stderr: string;
    stdout: string;
}

/**
 * Captured-output brew runner. Never inherits stdio so callers decide what to
 * surface. A missing `brew` binary is reported as `missing: true`, not thrown,
 * so command flows can render the spec's friendly error.
 */
export function runBrewCaptured(args: string[]): BrewResult {
    const result = spawnSync('brew', args, {
        env: process.env,
        encoding: 'utf8',
    });

    if (result.error) {
        const missing = (result.error as NodeJS.ErrnoException).code === 'ENOENT';
        return {
            code: null,
            stdout: result.stdout ?? '',
            stderr: missing ? 'Homebrew is not installed.' : result.error.message,
            missing,
        };
    }

    return {
        code: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        missing: false,
    };
}

export interface Brew {
    isAvailable(): boolean;
    /** True when the formula has a newer version available. */
    isRuntimeOutdated(): boolean;
    servicesInfoRuntimeJson(): BrewResult;
    servicesRestartRuntime(): BrewResult;
    update(): BrewResult;
    upgradeRuntime(): BrewResult;
}

const FORMULA = 'grotto-runtime';

/**
 * Real brew implementation. Flows depend on this interface so tests inject a
 * fake without spawning processes.
 */
export const brew: Brew = {
    isAvailable() {
        return !runBrewCaptured(['--version']).missing;
    },
    update() {
        return runBrewCaptured(['update']);
    },
    upgradeRuntime() {
        return runBrewCaptured(['upgrade', FORMULA]);
    },
    isRuntimeOutdated() {
        // `brew outdated --quiet <formula>` exits 0 with no output when current,
        // and exits 1 (printing the name) when an upgrade is available.
        const result = runBrewCaptured(['outdated', '--quiet', FORMULA]);
        return result.code !== 0 || result.stdout.trim().length > 0;
    },
    servicesRestartRuntime() {
        return runBrewCaptured(['services', 'restart', FORMULA]);
    },
    servicesInfoRuntimeJson() {
        return runBrewCaptured(['services', 'info', FORMULA, '--json']);
    },
};
