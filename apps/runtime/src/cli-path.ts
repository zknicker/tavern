import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from './log.ts';

/**
 * Service environments (launchd, systemd) strip the user's shell PATH, which
 * silently breaks every spawn of a user-installed CLI — harness bridges
 * included. Runtime self-heals at startup: when a required CLI is missing
 * from PATH but lives in a well-known tool home, that directory is prepended
 * to the process PATH so all downstream spawns keep working.
 */

export function fallbackBinDirectories(): string[] {
    const home = os.homedir();
    return [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        path.join(home, '.local', 'bin'),
        path.join(home, '.bun', 'bin'),
        path.join(home, '.codex', 'bin'),
    ];
}

export function findExecutable(name: string): string | null {
    return findExecutableOnPath(name) ?? findExecutableInFallbacks(name);
}

export function ensureCliOnPath(name: string): string | null {
    const onPath = findExecutableOnPath(name);
    if (onPath) {
        return onPath;
    }

    for (const directory of fallbackBinDirectories()) {
        const candidate = path.join(directory, name);
        if (isExecutableFile(candidate)) {
            process.env.PATH = `${directory}${path.delimiter}${process.env.PATH ?? ''}`;
            log.info('CLI directory added to the Runtime PATH', { cli: name, directory });
            return candidate;
        }
    }

    return null;
}

function findExecutableOnPath(name: string): string | null {
    for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
        if (!directory) {
            continue;
        }
        const candidate = path.join(directory, name);
        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }
    return null;
}

function findExecutableInFallbacks(name: string): string | null {
    for (const directory of fallbackBinDirectories()) {
        const candidate = path.join(directory, name);
        if (isExecutableFile(candidate)) {
            return candidate;
        }
    }
    return null;
}

function isExecutableFile(candidate: string): boolean {
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return fs.statSync(candidate).isFile();
    } catch {
        return false;
    }
}
