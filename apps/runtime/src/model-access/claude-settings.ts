import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

// Runtime-owned Claude credentials (specs/model-access.md): the vault is the
// single store — never the macOS keychain, which a headless service cannot
// read. OAuth sign-in and a plain API key are the two shapes; OAuth wins
// when both exist because it carries the user's subscription.

const claudeSettingsSecretId = 'model-access:claude';

export const claudeSignInExpiredReason =
    'Claude sign-in expired; re-connect Claude in Model access.';

export interface StoredClaudeSettings {
    accessToken: string;
    accountEmail: string | null;
    apiKey: string;
    // Access-token expiry in epoch milliseconds; null for API keys.
    expiresAt: number | null;
    refreshToken: string | null;
}

interface TavernVaultSecretRow {
    secret_json: string;
    updated_at: string;
}

export function loadClaudeSettings(): StoredClaudeSettings | null {
    const row = getClaudeSettingsRow();
    if (!row) {
        return null;
    }
    const settings = parseClaudeSettings(row.secret_json);
    return settings.accessToken || settings.apiKey ? settings : null;
}

export function hasClaudeCredentials(): boolean {
    return loadClaudeSettings() !== null;
}

export function saveClaudeOAuthCredentials(input: {
    accessToken: string;
    accountEmail?: string | null;
    expiresAt: number | null;
    refreshToken: string | null;
}): void {
    const existing = loadClaudeSettings();
    writeClaudeSettings({
        accessToken: input.accessToken,
        accountEmail: input.accountEmail ?? existing?.accountEmail ?? null,
        apiKey: existing?.apiKey ?? '',
        expiresAt: input.expiresAt,
        refreshToken: input.refreshToken,
    });
}

export function saveClaudeApiKey(apiKey: string): void {
    const existing = loadClaudeSettings();
    writeClaudeSettings({
        accessToken: existing?.accessToken ?? '',
        accountEmail: existing?.accountEmail ?? null,
        apiKey,
        expiresAt: existing?.expiresAt ?? null,
        refreshToken: existing?.refreshToken ?? null,
    });
}

export function clearClaudeCredentials(): void {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: claudeSettingsSecretId }));
}

/**
 * The credential the Claude Code harness should use right now. OAuth access
 * tokens take precedence over an API key; freshness is the caller's job via
 * `ensureFreshClaudeCredentials` before the turn starts.
 */
export function getClaudeHarnessAuth(): { apiKey?: string; authToken?: string } | null {
    const settings = loadClaudeSettings();
    if (!settings) {
        return null;
    }
    if (settings.accessToken) {
        return { authToken: settings.accessToken };
    }
    return settings.apiKey ? { apiKey: settings.apiKey } : null;
}

export function getClaudeModelAccessStatus() {
    const settings = loadClaudeSettings();
    const signedIn = Boolean(settings?.accessToken);
    const label = signedIn
        ? (settings?.accountEmail ?? 'Claude account')
        : settings?.apiKey
          ? 'Anthropic API key'
          : null;
    return {
        description: label ?? 'Connect Claude to run Claude-powered agents.',
        id: 'claude',
        source: label ? 'secure-storage' : null,
        state: label ? 'live' : 'needs-auth',
    };
}

const refreshWindowMs = 5 * 60 * 1000;

/**
 * Refreshes the stored OAuth access token when it is near expiry. Call
 * before Claude-provider turns; API-key credentials pass through untouched.
 */
export async function ensureFreshClaudeCredentials(input?: {
    fetch?: typeof fetch;
    now?: Date;
}): Promise<void> {
    const settings = loadClaudeSettings();
    if (!settings?.accessToken) {
        return;
    }
    const now = (input?.now ?? new Date()).getTime();
    if (settings.expiresAt === null || settings.expiresAt - now > refreshWindowMs) {
        return;
    }
    if (!settings.refreshToken) {
        throw new Error(claudeSignInExpiredReason);
    }

    const { refreshClaudeTokens } = await import('./claude-oauth.ts');
    const refreshed = await refreshClaudeTokens(settings.refreshToken, input?.fetch ?? fetch);
    saveClaudeOAuthCredentials(refreshed);
}

function writeClaudeSettings(settings: StoredClaudeSettings): void {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
             VALUES ($id, $secretJson, $now, $now)
             ON CONFLICT(id) DO UPDATE SET
               secret_json = excluded.secret_json,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                id: claudeSettingsSecretId,
                now,
                secretJson: JSON.stringify(settings),
            })
        );
}

function getClaudeSettingsRow(): TavernVaultSecretRow | null {
    return (
        (getDb()
            .prepare(
                `SELECT secret_json, updated_at
                 FROM tavern_vault_secrets
                 WHERE id = $id`
            )
            .get(namedParams({ id: claudeSettingsSecretId })) as TavernVaultSecretRow | null) ??
        null
    );
}

function parseClaudeSettings(secretJson: string): StoredClaudeSettings {
    try {
        const parsed = JSON.parse(secretJson) as Partial<StoredClaudeSettings>;
        return {
            accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
            accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : null,
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
            expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
            refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
        };
    } catch {
        return {
            accessToken: '',
            accountEmail: null,
            apiKey: '',
            expiresAt: null,
            refreshToken: null,
        };
    }
}
