export interface UpdateFlags {
    restart: boolean;
    verbose: boolean;
}

export interface RestartFlags {
    noWait: boolean;
}

export class UsageError extends Error {}

/** Parse `tavern update` flags. Unknown flags raise UsageError (exit 2). */
export function parseUpdateFlags(args: string[]): UpdateFlags {
    const flags: UpdateFlags = { restart: false, verbose: false };
    for (const arg of args) {
        if (arg === '--restart') {
            flags.restart = true;
        } else if (arg === '--verbose') {
            flags.verbose = true;
        } else {
            throw new UsageError(`Unknown flag '${arg}' for 'tavern update'.`);
        }
    }
    return flags;
}

/** Parse `tavern restart` flags. Unknown flags raise UsageError (exit 2). */
export function parseRestartFlags(args: string[]): RestartFlags {
    const flags: RestartFlags = { noWait: false };
    for (const arg of args) {
        if (arg === '--no-wait') {
            flags.noWait = true;
        } else {
            throw new UsageError(`Unknown flag '${arg}' for 'tavern restart'.`);
        }
    }
    return flags;
}
