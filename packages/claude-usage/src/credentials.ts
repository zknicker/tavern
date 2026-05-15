import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ClaudeUsageParseError } from './errors.ts';
import type {
    ClaudeCredentials,
    ClaudeCredentialsLoadOptions,
    ClaudeLoadedCredentials,
} from './types.ts';

const execFileAsync = promisify(execFile);
const DEFAULT_KEYCHAIN_SERVICE = 'Claude Code-credentials';

const claudeOauthSchema = z
    .object({
        accessToken: z.string().trim().min(1),
        expiresAt: z.number().finite().optional(),
        refreshToken: z.string().trim().min(1).optional(),
        subscriptionType: z.string().trim().min(1).optional(),
    })
    .passthrough();

const claudeCredentialsDocumentSchema = z
    .object({
        claudeAiOauth: claudeOauthSchema,
    })
    .passthrough();

export function resolveClaudeCredentialsPath(options: ClaudeCredentialsLoadOptions = {}): string {
    return (
        options.credentialsPath ??
        path.join(options.homeDir ?? os.homedir(), '.claude', '.credentials.json')
    );
}

export function parseClaudeCredentialsDocument(input: unknown): {
    credentials: ClaudeCredentials;
    document: Record<string, unknown>;
} {
    const document = claudeCredentialsDocumentSchema.parse(input);

    return {
        credentials: {
            accessToken: document.claudeAiOauth.accessToken,
            expiresAt: document.claudeAiOauth.expiresAt ?? null,
            refreshToken: document.claudeAiOauth.refreshToken ?? null,
            subscriptionType: document.claudeAiOauth.subscriptionType ?? null,
        },
        document,
    };
}

export async function loadClaudeCredentials(
    options: ClaudeCredentialsLoadOptions = {}
): Promise<ClaudeLoadedCredentials | null> {
    const credentialsPath = resolveClaudeCredentialsPath(options);

    try {
        const raw = await readFile(credentialsPath, 'utf8');
        const parsed = parseClaudeCredentialsDocument(JSON.parse(raw));

        return {
            credentials: parsed.credentials,
            document: parsed.document,
            path: credentialsPath,
            source: 'file',
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            if (error instanceof SyntaxError || error instanceof z.ZodError) {
                throw new ClaudeUsageParseError(`Invalid Claude credentials at ${credentialsPath}`);
            }

            throw error;
        }
    }

    if (options.useKeychain !== false) {
        const keychainJson = await (options.readKeychain ?? readClaudeKeychain)(
            options.keychainService ?? DEFAULT_KEYCHAIN_SERVICE
        );

        if (keychainJson) {
            try {
                const parsed = parseClaudeCredentialsDocument(JSON.parse(keychainJson));

                return {
                    credentials: parsed.credentials,
                    document: parsed.document,
                    path: null,
                    source: 'keychain',
                };
            } catch (error) {
                if (error instanceof SyntaxError || error instanceof z.ZodError) {
                    throw new ClaudeUsageParseError('Invalid Claude credentials in Keychain');
                }

                throw error;
            }
        }
    }

    const token = options.environment?.CLAUDE_CODE_OAUTH_TOKEN?.trim();
    if (!token) {
        return null;
    }

    return {
        credentials: {
            accessToken: token,
            expiresAt: null,
            refreshToken: null,
            subscriptionType: null,
        },
        document: null,
        path: null,
        source: 'environment',
    };
}

async function readClaudeKeychain(service: string): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync('/usr/bin/security', [
            'find-generic-password',
            '-s',
            service,
            '-w',
        ]);

        const value = stdout.trim();
        return value.length > 0 ? value : null;
    } catch (error) {
        const exitCode = (error as { code?: number | string }).code;
        if (exitCode === 44 || exitCode === '44') {
            return null;
        }

        return null;
    }
}
