import os from 'node:os';
import path from 'node:path';

import { readEnvFile } from './env';
import { isValidTimezone } from './timezone';

const envConfig = readEnvFile([
    'TAVERN_OPENCLAW_GATEWAY_PORT',
    'TAVERN_OPENCLAW_CORTEX_PLUGIN_DEPLOY_PATH',
    'TAVERN_OPENCLAW_CORTEX_PLUGIN_PATH',
    'TAVERN_OPENCLAW_PLUGIN_PATH',
    'TAVERN_OPENCLAW_PLUGIN_DEPLOY_PATH',
    'TAVERN_OPENCLAW_VERSION',
    'TAVERN_OPENCLAW_WORKSPACE_PLUGIN_DEPLOY_PATH',
    'TAVERN_OPENCLAW_WORKSPACE_PLUGIN_PATH',
    'TAVERN_RUNTIME_ROOT',
    'OPENCLAW_CONFIG_DIR',
    'OPENCLAW_CONFIG_PATH',
    'OPENCLAW_GATEWAY_TOKEN',
    'TZ',
]);

const homeDir = process.env.HOME || os.homedir();

function resolveRuntimeRoot(): string {
    const configuredRoot = process.env.TAVERN_RUNTIME_ROOT || envConfig.TAVERN_RUNTIME_ROOT;
    if (!(configuredRoot && configuredRoot.trim().length > 0)) {
        return path.join(homeDir, '.tavern', 'runtime');
    }

    const trimmed = configuredRoot.trim();
    if (trimmed === '~') {
        return homeDir;
    }
    if (trimmed.startsWith('~/')) {
        return path.join(homeDir, trimmed.slice(2));
    }

    return path.resolve(trimmed);
}

export const RUNTIME_ROOT = resolveRuntimeRoot();
export const DATA_DIR = path.join(RUNTIME_ROOT, 'data');
export const OPENCLAW_ROOT = path.join(RUNTIME_ROOT, 'openclaw');
export const OPENCLAW_INSTALL_ROOT = path.join(OPENCLAW_ROOT, 'versions');
export const OPENCLAW_RUN_ROOT = path.join(OPENCLAW_ROOT, 'run');

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

export function readConfigValue(key: string): string | null {
    return process.env[key]?.trim() || envConfig[key]?.trim() || null;
}
