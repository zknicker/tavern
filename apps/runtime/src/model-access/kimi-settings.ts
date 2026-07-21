import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

// Runtime-owned Kimi Code sign-in credentials: the OAuth device-flow tokens
// from the user's Kimi Code subscription (auth.kimi.com). The vault is the
// single store, mirroring Claude sign-in (claude-settings.ts). Metered
// Moonshot API keys are not a Tavern provider; the subscription is the
// point.

const kimiSettingsSecretId = 'model-access:kimi';

export const kimiSignInExpiredReason =
    'Kimi Code sign-in expired; re-connect Kimi in Model access.';

export interface StoredKimiSettings {
    accessToken: string;
    // Stable device id sent to the Kimi OAuth endpoints, minted on first use.
    deviceId: string | null;
    // Access-token expiry in epoch milliseconds.
    expiresAt: number | null;
    refreshToken: string | null;
}

interface TavernVaultSecretRow {
    secret_json: string;
    updated_at: string;
}

export function loadKimiSettings(): StoredKimiSettings | null {
    const row = getKimiSettingsRow();
    if (!row) {
        return null;
    }
    const settings = parseKimiSettings(row.secret_json);
    return settings.accessToken ? settings : null;
}

export function hasKimiCredentials(): boolean {
    return loadKimiSettings() !== null;
}

export function saveKimiOAuthCredentials(input: {
    accessToken: string;
    expiresAt: number | null;
    refreshToken: string | null;
}): void {
    writeKimiSettings({
        accessToken: input.accessToken,
        deviceId: readStoredDeviceId(),
        expiresAt: input.expiresAt,
        refreshToken: input.refreshToken,
    });
}

export function clearKimiCredentials(): void {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: kimiSettingsSecretId }));
}

/**
 * The device id sent with Kimi OAuth requests. Persisted beside the tokens
 * (and before any exist) so authorizations stay tied to one Tavern install.
 */
export function getOrCreateKimiDeviceId(): string {
    const existing = readStoredDeviceId();
    if (existing) {
        return existing;
    }
    const deviceId = crypto.randomUUID().replaceAll('-', '');
    const row = getKimiSettingsRow();
    const settings = row ? parseKimiSettings(row.secret_json) : emptyKimiSettings();
    writeKimiSettings({ ...settings, deviceId });
    return deviceId;
}

/**
 * The sign-in credential the pi harness should use right now. Freshness is
 * the caller's job via `ensureFreshKimiCredentials` before the turn starts.
 */
export function getKimiHarnessAuth(): { accessToken: string } | null {
    const settings = loadKimiSettings();
    return settings ? { accessToken: settings.accessToken } : null;
}

export function getKimiModelAccessStatus() {
    if (hasKimiCredentials()) {
        return {
            description: 'Kimi Code subscription is connected.',
            id: 'kimi',
            source: 'secure-storage',
            state: 'live',
        };
    }
    return {
        description: 'Sign in with Kimi Code to run Kimi-powered agents.',
        id: 'kimi',
        source: null,
        state: 'needs-auth',
    };
}

const refreshWindowMs = 5 * 60 * 1000;

/**
 * Refreshes the stored OAuth access token when it is near expiry. Call
 * before kimi-provider turns.
 */
export async function ensureFreshKimiCredentials(input?: {
    fetch?: typeof fetch;
    now?: Date;
}): Promise<void> {
    const settings = loadKimiSettings();
    if (!settings) {
        return;
    }
    const now = (input?.now ?? new Date()).getTime();
    if (settings.expiresAt === null || settings.expiresAt - now > refreshWindowMs) {
        return;
    }
    if (!settings.refreshToken) {
        throw new Error(kimiSignInExpiredReason);
    }

    const { refreshKimiTokens } = await import('./kimi-oauth.ts');
    const refreshed = await refreshKimiTokens(settings.refreshToken, input?.fetch ?? fetch);
    saveKimiOAuthCredentials(refreshed);
}

function readStoredDeviceId(): string | null {
    const row = getKimiSettingsRow();
    return row ? parseKimiSettings(row.secret_json).deviceId : null;
}

function emptyKimiSettings(): StoredKimiSettings {
    return { accessToken: '', deviceId: null, expiresAt: null, refreshToken: null };
}

function writeKimiSettings(settings: StoredKimiSettings): void {
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
                id: kimiSettingsSecretId,
                now,
                secretJson: JSON.stringify(settings),
            })
        );
}

function getKimiSettingsRow(): TavernVaultSecretRow | null {
    return (
        (getDb()
            .prepare(
                `SELECT secret_json, updated_at
                 FROM tavern_vault_secrets
                 WHERE id = $id`
            )
            .get(namedParams({ id: kimiSettingsSecretId })) as TavernVaultSecretRow | null) ?? null
    );
}

function parseKimiSettings(secretJson: string): StoredKimiSettings {
    try {
        const parsed = JSON.parse(secretJson) as Partial<StoredKimiSettings>;
        return {
            accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
            deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null,
            expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
            refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
        };
    } catch {
        return emptyKimiSettings();
    }
}
