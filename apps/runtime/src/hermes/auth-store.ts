import fs from 'node:fs/promises';
import path from 'node:path';
import type { CodexLoadedCredentials } from '@tavern/codex-usage';

interface HermesAuthStore {
    credential_pool?: unknown;
    providers?: Record<string, unknown>;
    updated_at?: unknown;
    version?: unknown;
}

export async function syncHermesCodexAuth(
    filePath: string,
    credentials: CodexLoadedCredentials | null
) {
    if (!credentials?.credentials.accessToken) {
        return;
    }

    const existing = await readHermesAuthStore(filePath);
    const providers = readProviders(existing.providers);
    const openAiCodex = readProviderState(providers['openai-codex']);
    const now = new Date().toISOString();

    providers['openai-codex'] = {
        ...openAiCodex,
        auth_mode: 'chatgpt',
        last_refresh: credentials.credentials.lastRefresh,
        tokens: {
            access_token: credentials.credentials.accessToken,
            ...(credentials.credentials.accountId
                ? { account_id: credentials.credentials.accountId }
                : {}),
            ...(credentials.credentials.refreshToken
                ? { refresh_token: credentials.credentials.refreshToken }
                : {}),
        },
        updated_at: now,
    };

    const next: HermesAuthStore = {
        ...existing,
        providers,
        updated_at: now,
        version: typeof existing.version === 'number' ? existing.version : 1,
    };

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await fs.chmod(filePath, 0o600).catch(() => undefined);
}

async function readHermesAuthStore(filePath: string): Promise<HermesAuthStore> {
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as HermesAuthStore)
            : {};
    } catch {
        return {};
    }
}

function readProviders(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};
}

function readProviderState(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};
}
