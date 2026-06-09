import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readEnvFile } from './env';
import { isValidTimezone } from './timezone';

const envConfig = readEnvFile([
    'HERMES_HOME',
    'TAVERN_HERMES_BIN',
    'TAVERN_HERMES_HOME',
    'TAVERN_HERMES_HOST',
    'TAVERN_HERMES_MODEL',
    'TAVERN_HERMES_API_KEY',
    'TAVERN_HERMES_BASE_URL',
    'TAVERN_HERMES_PORT',
    'TAVERN_HERMES_PROVIDER',
    'TAVERN_HERMES_TOKEN',
    'TAVERN_MNEMOSYNE_PACKAGE_SPEC',
    'HERMES_DASHBOARD_SESSION_TOKEN',
    'TAVERN_CORTEX_DATABASE_PATH',
    'TAVERN_CORTEX_WIKI_PATH',
    'TAVERN_RUNTIME_ASSETS_DIR',
    'TAVERN_WIKI_HUB_PATH',
    'TAVERN_RUNTIME_HOST',
    'TAVERN_RUNTIME_PORT',
    'TAVERN_RUNTIME_ROOT',
    'CODEX_MODEL',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    'TZ',
]);

const homeDir = process.env.HOME || os.homedir();

export function resolveConfiguredPath(configuredPath: string): string {
    const trimmed = configuredPath.trim();
    if (trimmed === '~') {
        return homeDir;
    }
    if (trimmed.startsWith('~/')) {
        return path.join(homeDir, trimmed.slice(2));
    }

    return path.resolve(trimmed);
}

function resolveRuntimeRoot(): string {
    const configuredRoot = process.env.TAVERN_RUNTIME_ROOT || envConfig.TAVERN_RUNTIME_ROOT;
    if (!(configuredRoot && configuredRoot.trim().length > 0)) {
        return path.join(homeDir, '.tavern-hermes', 'runtime');
    }

    return resolveConfiguredPath(configuredRoot);
}

export const RUNTIME_ROOT = resolveRuntimeRoot();
export const DATA_DIR = path.join(RUNTIME_ROOT, 'data');
export const HERMES_ROOT = path.join(RUNTIME_ROOT, 'hermes');
export const HERMES_WORKSPACE = path.join(HERMES_ROOT, 'workspace');
export const HERMES_HOME = resolveConfiguredPath(
    readConfigValue('TAVERN_HERMES_HOME') ??
        readConfigValue('HERMES_HOME') ??
        path.join(HERMES_ROOT, 'home')
);
export const HERMES_DASHBOARD_SESSION_TOKEN = resolveHermesDashboardSessionToken();

function resolveHermesDashboardSessionToken(): string {
    const configured =
        readConfigValue('TAVERN_HERMES_TOKEN') ?? readConfigValue('HERMES_DASHBOARD_SESSION_TOKEN');
    if (configured) {
        return configured;
    }

    const tokenPath = path.join(HERMES_HOME, 'dashboard-session-token');
    try {
        const existing = fs.readFileSync(tokenPath, 'utf8').trim();
        if (existing) {
            return existing;
        }
    } catch {
        // First run creates the managed local token below.
    }

    const token = randomBytes(32).toString('base64url');
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
    try {
        fs.chmodSync(tokenPath, 0o600);
    } catch {
        // chmod is best-effort on non-POSIX filesystems.
    }
    return token;
}

function resolveConfigTimezone(): string {
    const candidates = [
        process.env.TZ,
        envConfig.TZ,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    ];
    for (const timezone of candidates) {
        if (timezone && isValidTimezone(timezone)) {
            return timezone;
        }
    }
    return 'UTC';
}

export const TIMEZONE = resolveConfigTimezone();

export function getRuntimeHost(): string {
    return readConfigValue('TAVERN_RUNTIME_HOST') ?? '127.0.0.1';
}

export function getRuntimePort(): string {
    return readConfigValue('TAVERN_RUNTIME_PORT') ?? '18790';
}

export function readConfigValue(key: string): string | null {
    if (process.env[key] !== undefined) {
        return process.env[key]?.trim() || null;
    }
    return envConfig[key]?.trim() || null;
}
