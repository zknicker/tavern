import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    generateCodexImage,
    setCodexImageGenerationDependenciesForTesting,
} from './codex-image-generation.ts';

const now = new Date('2030-01-02T03:04:05.000Z');
const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('Codex subscription image generation', () => {
    let codexHome: string;
    let restoreDependencies: (() => void) | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        codexHome = await fs.mkdtemp(path.join(tmpdir(), 'tavern-codex-image-'));
        vi.stubEnv('CODEX_HOME', codexHome);
    });

    afterEach(async () => {
        restoreDependencies?.();
        restoreDependencies = undefined;
        closeDb();
        vi.unstubAllEnvs();
        await fs.rm(codexHome, { force: true, recursive: true });
    });

    test('uses a valid access token without refreshing it', async () => {
        await writeAuthFile({
            accessToken: accessTokenAfter(60 * 60),
            refreshToken: 'refresh-old',
        });
        const refreshFetch = vi.fn(() => {
            throw new Error('refresh should not run');
        });
        const generateText = vi.fn(async (_input: unknown) => await imageResult());
        restoreDependencies = setCodexImageGenerationDependenciesForTesting({
            fetch: refreshFetch as unknown as typeof fetch,
            generateText,
            now: () => now,
        });

        await expect(
            generateCodexImage({ prompt: 'A blue moon', size: '1024x1536' })
        ).resolves.toEqual({ mediaType: 'image/png', uint8Array: imageBytes });
        expect(refreshFetch).not.toHaveBeenCalled();
        expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ size: '1024x1536' }));
    });

    test('refreshes an expiring token and atomically preserves the auth document', async () => {
        const authPath = await writeAuthFile({
            accessToken: accessTokenAfter(60),
            extra: { auth_mode: 'chatgpt', custom_setting: { keep: true } },
            refreshToken: 'refresh-old',
            tokenExtra: { id_token: 'id-old', keep_token_field: 'yes' },
        });
        const rotatedAccessToken = accessTokenAfter(60 * 60);
        const refreshFetch = vi.fn(
            async (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
                new Response(
                    JSON.stringify({
                        access_token: rotatedAccessToken,
                        id_token: 'id-new',
                        refresh_token: 'refresh-new',
                    }),
                    { headers: { 'content-type': 'application/json' }, status: 200 }
                )
        );
        restoreDependencies = setCodexImageGenerationDependenciesForTesting({
            fetch: refreshFetch as unknown as typeof fetch,
            generateText: imageResult,
            now: () => now,
        });

        await generateCodexImage({ prompt: 'A blue moon' });

        expect(refreshFetch).toHaveBeenCalledOnce();
        const [refreshUrl, refreshInit] = refreshFetch.mock.calls[0] ?? [];
        expect(refreshUrl).toBe('https://auth.openai.com/oauth/token');
        expect(refreshInit).toMatchObject({
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        });
        expect(refreshInit?.body?.toString()).toBe(
            'grant_type=refresh_token&refresh_token=refresh-old&client_id=app_EMoamEEZ73f0CkXaXp7hrann'
        );
        const rewritten = JSON.parse(await fs.readFile(authPath, 'utf8'));
        expect(rewritten).toMatchObject({
            auth_mode: 'chatgpt',
            custom_setting: { keep: true },
            last_refresh: now.toISOString(),
            tokens: {
                access_token: rotatedAccessToken,
                account_id: 'account-test',
                id_token: 'id-new',
                keep_token_field: 'yes',
                refresh_token: 'refresh-new',
            },
        });
        expect(await fs.readdir(codexHome)).toEqual(['auth.json']);
        const vault = getDb()
            .prepare('SELECT secret_json FROM tavern_vault_secrets WHERE id = ?')
            .get('model-access:codex') as { secret_json: string };
        expect(JSON.parse(vault.secret_json)).toMatchObject({
            accessToken: rotatedAccessToken,
            lastRefresh: now.toISOString(),
            refreshToken: 'refresh-new',
        });
    });

    test('surfaces an actionable refresh failure', async () => {
        await writeAuthFile({ accessToken: accessTokenAfter(60), refreshToken: 'refresh-old' });
        const generateText = vi.fn(async (_input: unknown) => await imageResult());
        restoreDependencies = setCodexImageGenerationDependenciesForTesting({
            fetch: vi.fn(
                async () => new Response(null, { status: 401, statusText: 'Unauthorized' })
            ) as unknown as typeof fetch,
            generateText,
            now: () => now,
        });

        await expect(generateCodexImage({ prompt: 'A blue moon' })).rejects.toThrow(
            'Codex sign-in expired; re-connect Codex in Model access.'
        );
        expect(generateText).not.toHaveBeenCalled();
    });

    test('extracts image bytes from the static image tool result', async () => {
        await writeAuthFile({
            accessToken: accessTokenAfter(60 * 60),
            refreshToken: 'refresh-old',
        });
        restoreDependencies = setCodexImageGenerationDependenciesForTesting({
            generateText: async () => ({
                staticToolResults: [
                    {
                        output: { result: Buffer.from([1, 2, 3, 4]).toString('base64') },
                        toolName: 'image_generation',
                    },
                ],
            }),
            now: () => now,
        });

        const result = await generateCodexImage({ prompt: 'Four pixels' });

        expect(result.mediaType).toBe('image/png');
        expect(result.uint8Array).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    test('omits unsupported image sizes', async () => {
        await writeAuthFile({
            accessToken: accessTokenAfter(60 * 60),
            refreshToken: 'refresh-old',
        });
        const generateText = vi.fn(async (_input: unknown) => await imageResult());
        restoreDependencies = setCodexImageGenerationDependenciesForTesting({
            generateText,
            now: () => now,
        });

        await generateCodexImage({ prompt: 'Large moon', size: '2048x2048' });

        expect(generateText).toHaveBeenCalledOnce();
        expect(generateText.mock.calls[0]?.[0]).not.toHaveProperty('size');
    });

    async function writeAuthFile(input: {
        accessToken: string;
        extra?: Record<string, unknown>;
        refreshToken: string;
        tokenExtra?: Record<string, unknown>;
    }) {
        const authPath = path.join(codexHome, 'auth.json');
        await fs.writeFile(
            authPath,
            JSON.stringify({
                ...input.extra,
                last_refresh: '2029-01-01T00:00:00.000Z',
                tokens: {
                    ...input.tokenExtra,
                    access_token: input.accessToken,
                    account_id: 'account-test',
                    refresh_token: input.refreshToken,
                },
            })
        );
        return authPath;
    }
});

async function imageResult() {
    return {
        staticToolResults: [
            {
                output: { result: Buffer.from(imageBytes).toString('base64') },
                toolName: 'image_generation',
            },
        ],
    };
}

function accessTokenAfter(seconds: number) {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(now.getTime() / 1000) + seconds })
    ).toString('base64url');
    return `header.${payload}.signature`;
}
