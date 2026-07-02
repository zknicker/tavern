import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readEnvFile } from './env.ts';
import { isValidTimezone } from './timezone.ts';

const envConfig = readEnvFile([
    'TAVERN_AGENT_MODEL_PROVIDER',
    'TAVERN_AGENT_API_KEY',
    'TAVERN_AGENT_BASE_URL',
    'TAVERN_AGENT_CLAUDE_CODE_COMMAND',
    'TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN',
    'TAVERN_AGENT_CLAUDE_CODE_BASE_URL',
    'TAVERN_AGENT_CLAUDE_MODEL',
    'TAVERN_AGENT_CODEX_CLI_COMMAND',
    'TAVERN_AGENT_CODEX_MODEL',
    'TAVERN_AGENT_HOME',
    'TAVERN_AGENT_MODEL',
    'TAVERN_AGENT_MODEL_DISCOVERY_TIMEOUT_MS',
    'TAVERN_AGENT_TURN_TIMEOUT_MS',
    'TAVERN_AGENT_OPENAI_MODEL',
    'TAVERN_AGENT_PROVIDER',
    'TAVERN_AGENT_WORKSPACE',
    'TAVERN_RUNTIME_ASSETS_DIR',
    'TAVERN_RUNTIME_HOST',
    'TAVERN_RUNTIME_PORT',
    'TAVERN_RUNTIME_ROOT',
    'TAVERN_RUNTIME_TOKEN',
    'TAVERN_VAULT_PATH',
    'CODEX_MODEL',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
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
        return resolveDefaultRuntimeRoot();
    }

    return resolveConfiguredPath(configuredRoot);
}

function resolveDefaultRuntimeRoot(): string {
    return path.join(homeDir, '.tavern', 'runtime');
}

export const RUNTIME_ROOT = resolveRuntimeRoot();
export const DATA_DIR = path.join(RUNTIME_ROOT, 'data');
export const AGENT_HOME = resolveConfiguredPath(
    readConfigValue('TAVERN_AGENT_HOME') ?? path.join(RUNTIME_ROOT, 'agent')
);
export const AGENT_WORKSPACE = resolveConfiguredPath(
    readConfigValue('TAVERN_AGENT_WORKSPACE') ?? path.join(RUNTIME_ROOT, 'agent', 'workspace')
);

function resolveRuntimeApiToken(): string {
    const configured = readConfigValue('TAVERN_RUNTIME_TOKEN');
    if (configured) {
        return configured;
    }

    const config = readTavernConfig();
    const existing = typeof config.token === 'string' ? config.token.trim() : '';
    if (existing) {
        return existing;
    }

    const token = randomBytes(32).toString('base64url');
    writeTavernConfig({ ...config, token });
    return token;
}

export function getTavernConfigPath(): string {
    return path.join(RUNTIME_ROOT, 'tavern.json');
}

// tavern.json is the runtime host's config file (mode 0600 — it holds the API
// token). Unknown keys are preserved on write so operator edits survive.
function readTavernConfig(): Record<string, unknown> {
    const configPath = getTavernConfigPath();
    let content: string;
    try {
        content = fs.readFileSync(configPath, 'utf8');
    } catch {
        // First run creates the config on write.
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('expected a JSON object');
        }
        return parsed as Record<string, unknown>;
    } catch (error) {
        // Never clobber an operator-edited config file we cannot parse.
        throw new Error(
            `Tavern Runtime config at ${configPath} is not valid JSON: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

function writeTavernConfig(config: Record<string, unknown>): void {
    const configPath = getTavernConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    try {
        fs.chmodSync(configPath, 0o600);
    } catch {
        // chmod is best-effort on non-POSIX filesystems.
    }
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

export function getRuntimeApiToken(): string {
    // Re-resolve on each call so test env overrides take effect after module import.
    return resolveRuntimeApiToken();
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
