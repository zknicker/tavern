import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

// Runtime-owned Claude sign-in credentials (specs/model-access.md): the
// vault is the single store — never the macOS keychain, which a headless
// service cannot read. Plain Anthropic API keys are a separate provider
// (anthropic-settings.ts), the way OpenAI is separate from Codex.

const claudeSettingsSecretId = 'model-access:claude';

export const claudeSignInExpiredReason =
    'Claude sign-in expired; re-connect Claude in Model access.';

export interface StoredClaudeSettings {
    accessToken: string;
    accountEmail: string | null;
    // Access-token expiry in epoch milliseconds.
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
    return settings.accessToken ? settings : null;
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
        expiresAt: input.expiresAt,
        refreshToken: input.refreshToken,
    });
}

export function clearClaudeCredentials(): void {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: claudeSettingsSecretId }));
}

/**
 * The sign-in credential the Claude Code harness should use right now.
 * Freshness is the caller's job via `ensureFreshClaudeCredentials` before
 * the turn starts.
 */
export function getClaudeHarnessAuth(): { authToken: string } | null {
    const settings = loadClaudeSettings();
    return settings ? { authToken: settings.accessToken } : null;
}

export function getClaudeModelAccessStatus() {
    const settings = loadClaudeSettings();
    const label = settings ? (settings.accountEmail ?? 'Claude account') : null;
    return {
        description: label ?? 'Sign in with Claude to run Claude-powered agents.',
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
    if (!settings) {
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
            expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
            refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
        };
    } catch {
        return {
            accessToken: '',
            accountEmail: null,
            expiresAt: null,
            refreshToken: null,
        };
    }
}
