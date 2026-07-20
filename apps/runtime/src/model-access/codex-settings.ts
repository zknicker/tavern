import { existsSync } from 'node:fs';
import {
    type CodexLoadedCredentials,
    decodeCodexAccessTokenMetadata,
    loadCodexCredentials,
    resolveCodexAuthPath,
} from '@tavern/codex-usage';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';

const codexSettingsSecretId = 'model-access:codex';

interface TavernVaultSecretRow {
    secret_json: string;
    updated_at: string;
}

interface StoredCodexSettings {
    accessToken: string;
    accountEmail: string | null;
    accountId: string | null;
    lastRefresh: string | null;
    refreshToken: string | null;
}

export async function loadVaultBackedCodexCredentials(): Promise<CodexLoadedCredentials | null> {
    const fileCredentials = await loadCodexCredentials({ environment: process.env });
    if (fileCredentials) {
        saveCodexCredentials(fileCredentials);
        return fileCredentials;
    }

    const row = getCodexSettingsRow();
    if (!row) {
        return null;
    }
    const secret = parseCodexSettings(row.secret_json);
    if (!secret.accessToken) {
        return null;
    }

    return {
        credentials: {
            accessToken: secret.accessToken,
            accountId: secret.accountId,
            lastRefresh: secret.lastRefresh,
            refreshToken: secret.refreshToken,
        },
        document: { accountEmail: secret.accountEmail },
        path: 'secure-storage',
        source: 'manual',
    };
}

export function hasCodexCredentials(): boolean {
    if (existsSync(resolveCodexAuthPath({ environment: process.env }))) {
        return true;
    }

    const row = getCodexSettingsRow();
    return row ? Boolean(parseCodexSettings(row.secret_json).accessToken) : false;
}

export async function getCodexModelAccessStatus() {
    const credentials = await loadVaultBackedCodexCredentials();
    const label = credentials ? getCodexAccountLabel(credentials) : '~/.codex/auth.json';
    return {
        description: credentials ? label : 'Sign in with Codex to create ~/.codex/auth.json.',
        id: 'codex',
        source: credentials ? 'secure-storage' : null,
        state: credentials ? 'live' : 'needs-auth',
    };
}

export function saveCodexCredentials(input: CodexLoadedCredentials): void {
    const now = new Date().toISOString();
    const metadata = decodeCodexAccessTokenMetadata(input.credentials.accessToken);
    const secret: StoredCodexSettings = {
        accountEmail: metadata?.email ?? null,
        accessToken: input.credentials.accessToken,
        accountId: input.credentials.accountId,
        lastRefresh: input.credentials.lastRefresh,
        refreshToken: input.credentials.refreshToken,
    };
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
                id: codexSettingsSecretId,
                now,
                secretJson: JSON.stringify(secret),
            })
        );
}

function getCodexSettingsRow(): TavernVaultSecretRow | null {
    return (
        (getDb()
            .prepare(
                `SELECT secret_json, updated_at
                 FROM tavern_vault_secrets
                 WHERE id = $id`
            )
            .get(namedParams({ id: codexSettingsSecretId })) as TavernVaultSecretRow | null) ?? null
    );
}

function parseCodexSettings(secretJson: string): StoredCodexSettings {
    try {
        const parsed = JSON.parse(secretJson) as Partial<StoredCodexSettings>;
        return {
            accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : null,
            accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
            accountId: typeof parsed.accountId === 'string' ? parsed.accountId : null,
            lastRefresh: typeof parsed.lastRefresh === 'string' ? parsed.lastRefresh : null,
            refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
        };
    } catch {
        return {
            accountEmail: null,
            accessToken: '',
            accountId: null,
            lastRefresh: null,
            refreshToken: null,
        };
    }
}

function getCodexAccountLabel(credentials: CodexLoadedCredentials): string {
    const metadata = decodeCodexAccessTokenMetadata(credentials.credentials.accessToken);
    return (
        metadata?.email ??
        readStoredAccountEmail(credentials.document) ??
        credentials.credentials.accountId ??
        (credentials.source === 'manual' ? 'Grotto Secret Storage' : credentials.path)
    );
}

function readStoredAccountEmail(document: Record<string, unknown>): string | null {
    return typeof document.accountEmail === 'string' && document.accountEmail.includes('@')
        ? document.accountEmail
        : null;
}
