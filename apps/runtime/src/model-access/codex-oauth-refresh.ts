import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type { CodexLoadedCredentials } from '@tavern/codex-usage';
import { saveCodexCredentials } from './codex-settings.ts';

const codexOauthTokenUrl = 'https://auth.openai.com/oauth/token';
const codexTokenRefreshWindowMs = 5 * 60 * 1000;

// Public OAuth client used by the Codex CLI sign-in flow.
const codexCliOauthClientId = 'app_EMoamEEZ73f0CkXaXp7hrann';

export const codexSignInExpiredReason = 'Codex sign-in expired; re-connect Codex in Model access.';

export async function refreshCodexCredentialsIfNeeded(
    loaded: CodexLoadedCredentials,
    input: { fetch: typeof fetch; now?: Date }
): Promise<CodexLoadedCredentials> {
    const now = input.now ?? new Date();
    const expiresAt = decodeAccessTokenExpiration(loaded.credentials.accessToken);
    if (expiresAt === null) {
        throw new Error('Codex sign-in token is invalid; re-connect Codex in Model access.');
    }
    if (expiresAt - now.getTime() > codexTokenRefreshWindowMs) {
        return loaded;
    }

    const refreshToken = loaded.credentials.refreshToken;
    if (!refreshToken) {
        throw new Error(codexSignInExpiredReason);
    }

    const response = await requestRefreshedTokens(input.fetch, refreshToken);
    const lastRefresh = now.toISOString();
    const refreshed: CodexLoadedCredentials = {
        ...loaded,
        credentials: {
            ...loaded.credentials,
            accessToken: response.accessToken,
            lastRefresh,
            refreshToken: response.refreshToken ?? refreshToken,
        },
        document: updateAuthDocument(loaded.document, {
            ...response,
            accountId: loaded.credentials.accountId,
            lastRefresh,
            refreshToken: response.refreshToken ?? refreshToken,
        }),
    };

    if (loaded.path !== 'secure-storage') {
        await writeAuthDocumentAtomically(loaded.path, refreshed.document);
    }
    try {
        saveCodexCredentials(refreshed);
    } catch (error) {
        throw new Error(
            `Codex token refresh succeeded but saving Tavern credentials failed: ${errorMessage(error)}`,
            { cause: error }
        );
    }

    return refreshed;
}

function decodeAccessTokenExpiration(accessToken: string): number | null {
    const payload = accessToken.split('.')[1];
    if (!payload) {
        return null;
    }
    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
            exp?: unknown;
        };
        return typeof parsed.exp === 'number' && Number.isFinite(parsed.exp)
            ? parsed.exp * 1000
            : null;
    } catch {
        return null;
    }
}

async function requestRefreshedTokens(fetch: typeof globalThis.fetch, refreshToken: string) {
    let response: Response;
    try {
        response = await fetch(codexOauthTokenUrl, {
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: codexCliOauthClientId,
            }),
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        });
    } catch (error) {
        throw new Error(`Codex token refresh failed: ${errorMessage(error)}`, { cause: error });
    }

    if (response.status === 401) {
        throw new Error(codexSignInExpiredReason);
    }
    if (!response.ok) {
        throw new Error(
            `Codex token refresh failed: ${response.status} ${response.statusText}`.trim()
        );
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.access_token !== 'string' || !body.access_token) {
        throw new Error('Codex token refresh returned no access token; re-connect Codex.');
    }
    return {
        accessToken: body.access_token,
        idToken: typeof body.id_token === 'string' ? body.id_token : null,
        refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    };
}

function updateAuthDocument(
    document: Record<string, unknown>,
    input: {
        accessToken: string;
        accountId: null | string;
        idToken: null | string;
        lastRefresh: string;
        refreshToken: string;
    }
) {
    const currentTokens = isRecord(document.tokens) ? document.tokens : {};
    return {
        ...document,
        last_refresh: input.lastRefresh,
        tokens: {
            ...currentTokens,
            access_token: input.accessToken,
            account_id: input.accountId,
            ...(input.idToken ? { id_token: input.idToken } : {}),
            refresh_token: input.refreshToken,
        },
    };
}

async function writeAuthDocumentAtomically(filePath: string, document: Record<string, unknown>) {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        const mode = await fs.stat(filePath).then((stat) => stat.mode);
        await fs.writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { mode });
        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw new Error(
            `Codex token refresh succeeded but saving ${filePath} failed: ${errorMessage(error)}`,
            { cause: error }
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
