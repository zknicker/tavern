import fs from 'node:fs';
import path from 'node:path';

import { readConfigValue } from '../config';

const defaultOpenClawVersion = '2026.5.27';

export function resolveManagedOpenClawVersion(startDirectory = process.cwd()): string {
    const configured = readConfigValue('TAVERN_OPENCLAW_VERSION');
    if (configured) {
        return configured;
    }

    const packageJsonPath = findUpwards('package.json', startDirectory);
    if (!packageJsonPath) {
        return defaultOpenClawVersion;
    }

    const version = readOpenClawVersionFromPackageJson(packageJsonPath);
    return version ?? defaultOpenClawVersion;
}

export function readOpenClawPackageVersion(packageRoot: string): string | null {
    return readPackageVersion(path.join(packageRoot, 'package.json'));
}

function readOpenClawVersionFromPackageJson(packageJsonPath: string) {
    try {
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        return parsed.dependencies?.openclaw ?? parsed.devDependencies?.openclaw ?? null;
    } catch {
        return null;
    }
}

function readPackageVersion(packageJsonPath: string) {
    try {
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
            version?: unknown;
        };
        return typeof parsed.version === 'string' ? parsed.version : null;
    } catch {
        return null;
    }
}

function findUpwards(filename: string, startDirectory: string) {
    let currentDirectory = path.resolve(startDirectory);

    while (true) {
        const candidate = path.join(currentDirectory, filename);
        if (fs.existsSync(candidate)) {
            return candidate;
        }

        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            return null;
        }

        currentDirectory = parentDirectory;
    }
}
