import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { saveModelCapabilitySelections } from '../models/capability-selections.ts';
import {
    createImageGenerationTools,
    setCodexImageGenerationForTesting,
    setGenerateImageForTesting,
} from './agent-tools.ts';

const png = createPng(8, 8);

describe('image generation agent tool', () => {
    let restoreGenerateImage: (() => void) | undefined;
    let restoreGenerateCodexImage: (() => void) | undefined;
    let workspaceFolder: string;

    beforeEach(async () => {
        workspaceFolder = await fs.mkdtemp(path.join(tmpdir(), 'tavern-image-tools-'));
        ensureRuntimeSchema(initTestDb());
        vi.stubEnv('OPENAI_API_KEY', 'sk-test');
        vi.stubEnv('TAVERN_AGENT_API_KEY', '');
        vi.stubEnv('CODEX_HOME', path.join(workspaceFolder, '.empty-codex-home'));
        saveModelCapabilitySelections({
            selections: { imageGeneration: { model: 'gpt-image-2', provider: 'openai' } },
        });
        restoreGenerateImage = setGenerateImageForTesting(async () => ({
            image: { mediaType: 'image/png', uint8Array: png },
        }));
        restoreGenerateCodexImage = setCodexImageGenerationForTesting(async () => ({
            mediaType: 'image/png',
            uint8Array: png,
        }));
    });

    afterEach(async () => {
        restoreGenerateImage?.();
        restoreGenerateCodexImage?.();
        closeDb();
        vi.unstubAllEnvs();
        await fs.rm(workspaceFolder, { force: true, recursive: true });
    });

    test('writes a generated image to the default workspace path', async () => {
        const result = await runImageTool(createImageGenerationTools({ workspaceFolder }), {
            prompt: 'A Bright Blue Moon!',
            size: '1024x1024',
        });

        expect(result).toMatchObject({
            height: 8,
            link: expect.stringMatching(
                /^grotto:\/\/workspace\/workbench\/images\/a-bright-blue-moon-[a-z0-9]+\.png$/u
            ),
            mediaType: 'image/png',
            model: 'openai/gpt-image-2',
            path: expect.stringMatching(/^workbench\/images\/a-bright-blue-moon-[a-z0-9]+\.png$/u),
            width: 8,
        });
        await expect(fs.readFile(path.join(workspaceFolder, result.path))).resolves.toEqual(
            Buffer.from(png)
        );
    });

    test('honors a custom output path and encodes its link', async () => {
        const result = await runImageTool(createImageGenerationTools({ workspaceFolder }), {
            outputPath: 'generated/blue moon.png',
            prompt: 'Blue moon',
        });

        expect(result.path).toBe('generated/blue moon.png');
        expect(result.link).toBe('grotto://workspace/generated/blue%20moon.png');
        await expect(fs.readFile(path.join(workspaceFolder, result.path))).resolves.toEqual(
            Buffer.from(png)
        );
    });

    test.each(['../x.png', '/tmp/x.png'])('rejects output path %s', async (outputPath) => {
        await expect(
            runImageTool(createImageGenerationTools({ workspaceFolder }), {
                outputPath,
                prompt: 'Unsafe path',
            })
        ).rejects.toThrow(/workspace/u);
    });

    test('rejects unsupported output extensions', async () => {
        await expect(
            runImageTool(createImageGenerationTools({ workspaceFolder }), {
                outputPath: 'generated/image.gif',
                prompt: 'Wrong format',
            })
        ).rejects.toThrow('Image output path must end in .png, .jpg, .jpeg, or .webp.');
    });

    test('rejects a symlink that escapes the workspace', async () => {
        const outside = await fs.mkdtemp(path.join(tmpdir(), 'tavern-image-tools-outside-'));
        await fs.symlink(outside, path.join(workspaceFolder, 'escaped'));

        try {
            await expect(
                runImageTool(createImageGenerationTools({ workspaceFolder }), {
                    outputPath: 'escaped/image.png',
                    prompt: 'Escaped image',
                })
            ).rejects.toThrow('Image output path must stay inside the workspace');
            await expect(fs.stat(path.join(outside, 'image.png'))).rejects.toThrow();
        } finally {
            await fs.rm(outside, { force: true, recursive: true });
        }
    });

    test('reports an unset image model', async () => {
        saveModelCapabilitySelections({ selections: { imageGeneration: null } });

        await expect(
            runImageTool(createImageGenerationTools({ workspaceFolder }), { prompt: 'No model' })
        ).rejects.toThrow('No image generation model is selected.');
    });

    test('routes a Codex selection through subscription image generation', async () => {
        const generateCodexImage = vi.fn(async () => ({
            mediaType: 'image/png' as const,
            uint8Array: png,
        }));
        restoreGenerateCodexImage?.();
        restoreGenerateCodexImage = setCodexImageGenerationForTesting(generateCodexImage);
        saveModelCapabilitySelections({
            selections: { imageGeneration: { model: 'gpt-image-2', provider: 'codex' } },
        });
        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?)`
            )
            .run('model-access:codex', JSON.stringify({ accessToken: 'token' }), now, now);

        const result = await runImageTool(createImageGenerationTools({ workspaceFolder }), {
            prompt: 'Subscription moon',
            size: '1024x1536',
        });

        expect(generateCodexImage).toHaveBeenCalledWith({
            prompt: 'Subscription moon',
            size: '1024x1536',
        });
        expect(result).toMatchObject({
            height: 8,
            mediaType: 'image/png',
            model: 'codex/gpt-image-2',
            width: 8,
        });
        await expect(fs.readFile(path.join(workspaceFolder, result.path))).resolves.toEqual(
            Buffer.from(png)
        );
    });
});

interface ImageToolResult {
    height: number | null;
    link: string;
    mediaType: string;
    model: string;
    path: string;
    width: number | null;
}

async function runImageTool(
    tools: ReturnType<typeof createImageGenerationTools>,
    input: ImageToolInput
): Promise<ImageToolResult> {
    const selected = tools.image_generate as unknown as {
        execute: (
            input: ImageToolInput,
            options: { context: unknown; messages: []; toolCallId: string }
        ) => ImageToolResult | PromiseLike<ImageToolResult>;
    };
    return await selected.execute(input, {
        context: undefined,
        messages: [],
        toolCallId: 'call_image_generate',
    });
}

interface ImageToolInput {
    outputPath?: string;
    prompt: string;
    size?: string;
}

function createPng(width: number, height: number) {
    const signature = Buffer.from('89504e470d0a1a0a', 'hex');
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const row = Buffer.alloc(width * 4 + 1);
    const pixels = Buffer.concat(Array.from({ length: height }, () => row));
    return new Uint8Array(
        Buffer.concat([
            signature,
            pngChunk('IHDR', ihdr),
            pngChunk('IDAT', deflateSync(pixels)),
            pngChunk('IEND', Buffer.alloc(0)),
        ])
    );
}

function pngChunk(type: string, data: Buffer) {
    const name = Buffer.from(type);
    const chunk = Buffer.alloc(data.length + 12);
    chunk.writeUInt32BE(data.length, 0);
    name.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
    return chunk;
}

function crc32(bytes: Buffer) {
    let crc = 0xff_ff_ff_ff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xed_b8_83_20 : 0);
        }
    }
    return (crc ^ 0xff_ff_ff_ff) >>> 0;
}
