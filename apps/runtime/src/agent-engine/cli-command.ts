import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pathDelimiter = process.platform === 'win32' ? ';' : ':';

export function resolveCliCommand(command: string): string | null {
    const trimmed = command.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.includes('/') || path.isAbsolute(trimmed)) {
        return executablePath(trimmed);
    }

    for (const directory of commandSearchPaths()) {
        const candidate = executablePath(path.join(directory, trimmed));
        if (candidate) {
            return candidate;
        }
    }

    return null;
}

export function isCliCommandAvailable(command: string) {
    return Boolean(resolveCliCommand(command));
}

export function missingCliCommandMessage(input: { command: string; providerLabel: string }) {
    return `${input.providerLabel} is unavailable because "${input.command}" was not found in PATH or Tavern's local node_modules/.bin. Install the provider CLI or set the matching Tavern command environment variable.`;
}

function commandSearchPaths() {
    return [
        ...(process.env.PATH ?? '').split(pathDelimiter).filter(Boolean),
        path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '..',
            '..',
            'node_modules',
            '.bin'
        ),
    ];
}

function executablePath(candidate: string) {
    try {
        const realPath = fs.realpathSync(candidate);
        fs.accessSync(realPath, fs.constants.X_OK);
        return realPath;
    } catch {
        return null;
    }
}
