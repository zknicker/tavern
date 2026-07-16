import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

// Runtime-owned Anthropic API key (specs/model-access.md): the API-key
// sibling of Claude sign-in, a separate provider the same way OpenAI is
// the API-key sibling of Codex. Stored in the vault, never in keychains.

const anthropicSettingsSecretId = 'model-access:anthropic';

interface TavernVaultSecretRow {
    secret_json: string;
}

export function getAnthropicApiKey(): string | null {
    const row = getDb()
        .prepare('SELECT secret_json FROM tavern_vault_secrets WHERE id = $id')
        .get(namedParams({ id: anthropicSettingsSecretId })) as TavernVaultSecretRow | null;
    if (!row) {
        return null;
    }
    try {
        const parsed = JSON.parse(row.secret_json) as { apiKey?: unknown };
        const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
        return apiKey || null;
    } catch {
        return null;
    }
}

export function hasAnthropicApiKey(): boolean {
    return getAnthropicApiKey() !== null;
}

export function saveAnthropicApiKey(apiKey: string): void {
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
                id: anthropicSettingsSecretId,
                now,
                secretJson: JSON.stringify({ apiKey }),
            })
        );
}

export function clearAnthropicApiKey(): void {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: anthropicSettingsSecretId }));
}

export function getAnthropicModelAccessStatus() {
    const hasKey = hasAnthropicApiKey();
    return {
        description: hasKey
            ? 'Anthropic API key is saved in secure storage.'
            : 'Add an Anthropic API key.',
        id: 'anthropic',
        source: hasKey ? 'secure-storage' : null,
        state: hasKey ? 'live' : 'needs-auth',
    };
}
