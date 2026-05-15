import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { CodexUsageParseError } from './errors.ts';
import type {
    CodexCredentials,
    CodexCredentialsLoadOptions,
    CodexLoadedCredentials,
} from './types.ts';

const codexTokensSchema = z
    .object({
        access_token: z.string().trim().min(1),
        account_id: z.string().trim().min(1).optional(),
        refresh_token: z.string().trim().min(1).optional(),
    })
    .passthrough();

const codexAuthDocumentSchema = z
    .object({
        last_refresh: z.string().trim().min(1).optional(),
        tokens: codexTokensSchema,
    })
    .passthrough();

export function resolveCodexAuthPath(options: CodexCredentialsLoadOptions = {}): string {
    if (options.authPath) {
        return options.authPath;
    }

    if (options.codexHome) {
        return path.join(options.codexHome, 'auth.json');
    }

    const codexHome = options.environment?.CODEX_HOME?.trim();
    if (codexHome) {
        return path.join(codexHome, 'auth.json');
    }

    return path.join(options.homeDir ?? os.homedir(), '.codex', 'auth.json');
}

export function parseCodexAuthDocument(input: unknown): {
    credentials: CodexCredentials;
    document: Record<string, unknown>;
} {
    const document = codexAuthDocumentSchema.parse(input);

    return {
        credentials: {
            accessToken: document.tokens.access_token,
            accountId: document.tokens.account_id ?? null,
            lastRefresh: document.last_refresh ?? null,
            refreshToken: document.tokens.refresh_token ?? null,
        },
        document,
    };
}

export async function loadCodexCredentials(
    options: CodexCredentialsLoadOptions = {}
): Promise<CodexLoadedCredentials | null> {
    const authPath = resolveCodexAuthPath(options);

    try {
        const raw = await readFile(authPath, 'utf8');
        const parsed = parseCodexAuthDocument(JSON.parse(raw));

        return {
            credentials: parsed.credentials,
            document: parsed.document,
            path: authPath,
            source: 'file',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }

        if (error instanceof SyntaxError || error instanceof z.ZodError) {
            throw new CodexUsageParseError(`Invalid Codex auth file at ${authPath}`);
        }

        throw error;
    }
}
