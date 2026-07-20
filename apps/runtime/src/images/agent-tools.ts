import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolSet } from '@ai-sdk/provider-utils';
import type { ImageModel } from 'ai';
import { generateImage, tool } from 'ai';
import * as z from 'zod';
import { imageGenerationReadiness } from '../models/capability-selections.ts';
import { generateCodexImage } from '../models/codex-image-generation.ts';
import { createImageModelForRuntime } from '../models/image-model.ts';
import { parseImageDimensions } from './image-dimensions.ts';

interface GeneratedImage {
    image: {
        mediaType: string;
        uint8Array: Uint8Array;
    };
}

type GenerateImageForTool = (input: {
    model: ImageModel;
    prompt: string;
    size?: `${number}x${number}`;
}) => Promise<GeneratedImage>;

type GenerateCodexImageForTool = (input: {
    prompt: string;
    size?: string;
}) => Promise<GeneratedImage['image']>;

let generateImageForTool: GenerateImageForTool = generateImage;
let generateCodexImageForTool: GenerateCodexImageForTool = generateCodexImage;

export function setGenerateImageForTesting(factory: GenerateImageForTool) {
    const previous = generateImageForTool;
    generateImageForTool = factory;
    return () => {
        generateImageForTool = previous;
    };
}

export function setCodexImageGenerationForTesting(factory: GenerateCodexImageForTool) {
    const previous = generateCodexImageForTool;
    generateCodexImageForTool = factory;
    return () => {
        generateCodexImageForTool = previous;
    };
}

export function createImageGenerationTools(input: { workspaceFolder: string }): ToolSet {
    return {
        image_generate: tool({
            description:
                'Generate an image from a text prompt with the configured image model. Writes the image into your workspace (default workbench/images/) and returns its workspace path, link, and actual dimensions.',
            execute: async ({ outputPath, prompt, size }) => {
                const readiness = imageGenerationReadiness();
                if (!readiness.ready) {
                    throw new Error(readiness.reason);
                }

                const image =
                    readiness.model.provider === 'codex'
                        ? await generateCodexImageForTool({
                              prompt,
                              ...(size ? { size } : {}),
                          })
                        : (
                              await generateImageForTool({
                                  model: createImageModelForRuntime(readiness.model),
                                  prompt,
                                  ...(size ? { size: size as `${number}x${number}` } : {}),
                              })
                          ).image;
                const workspacePath = outputPath
                    ? normalizeOutputPath(outputPath)
                    : defaultOutputPath(prompt, image.mediaType);
                const destination = await resolveWorkspaceDestination(
                    input.workspaceFolder,
                    workspacePath
                );
                await fs.writeFile(destination, image.uint8Array);

                const dimensions = parseImageDimensions(image.uint8Array);
                return {
                    height: dimensions?.height ?? null,
                    link: workspaceLink(workspacePath),
                    mediaType: image.mediaType,
                    model: `${readiness.model.provider}/${readiness.model.model}`,
                    path: workspacePath,
                    width: dimensions?.width ?? null,
                };
            },
            inputSchema: z.object({
                outputPath: z
                    .string()
                    .optional()
                    .describe(
                        'Workspace-relative file path for the image (.png, .jpg, .jpeg, or .webp).'
                    ),
                prompt: z.string().trim().min(1),
                size: z
                    .string()
                    .regex(/^\d{3,4}x\d{3,4}$/u)
                    .optional()
                    .describe('{width}x{height}; support depends on the configured model.'),
            }),
        }),
    };
}

const supportedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp']);

function normalizeOutputPath(value: string) {
    const trimmed = value.trim();
    if (
        !trimmed ||
        path.posix.isAbsolute(trimmed) ||
        trimmed.startsWith('\\') ||
        /^[A-Za-z]:[\\/]/u.test(trimmed)
    ) {
        throw new Error(`Image output path must be workspace-relative: ${value}`);
    }
    const segments = trimmed.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error(`Image output path must stay inside the workspace: ${value}`);
    }
    if (!supportedExtensions.has(path.posix.extname(trimmed).toLowerCase())) {
        throw new Error('Image output path must end in .png, .jpg, .jpeg, or .webp.');
    }
    return path.posix.normalize(trimmed);
}

async function resolveWorkspaceDestination(workspaceFolder: string, relativePath: string) {
    const workspaceRoot = await fs.realpath(workspaceFolder).catch(() => {
        throw new Error(`Agent workspace does not exist: ${workspaceFolder}`);
    });
    const candidate = path.resolve(workspaceRoot, ...relativePath.split('/'));
    assertPathInside(candidate, workspaceRoot, relativePath);

    const existingParent = await nearestExistingPath(path.dirname(candidate));
    assertPathInside(existingParent, workspaceRoot, relativePath);
    await fs.mkdir(path.dirname(candidate), { recursive: true });
    const parent = await fs.realpath(path.dirname(candidate));
    const resolved = path.join(parent, path.basename(candidate));
    assertPathInside(resolved, workspaceRoot, relativePath);

    const existing = await fs.realpath(resolved).catch(() => null);
    if (existing) {
        assertPathInside(existing, workspaceRoot, relativePath);
        return existing;
    }
    return resolved;
}

async function nearestExistingPath(start: string) {
    let candidate = start;
    while (true) {
        const resolved = await fs.realpath(candidate).catch(() => null);
        if (resolved) {
            return resolved;
        }
        const parent = path.dirname(candidate);
        if (parent === candidate) {
            return candidate;
        }
        candidate = parent;
    }
}

function assertPathInside(filePath: string, root: string, relativePath: string) {
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        throw new Error(`Image output path must stay inside the workspace: ${relativePath}`);
    }
}

function defaultOutputPath(prompt: string, mediaType: string) {
    const slug =
        prompt
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
            .slice(0, 48)
            .replace(/-+$/gu, '') || 'image';
    const extension = extensionForMediaType(mediaType);
    return `workbench/images/${slug}-${Date.now().toString(36)}.${extension}`;
}

function extensionForMediaType(mediaType: string) {
    if (mediaType === 'image/jpeg') {
        return 'jpg';
    }
    if (mediaType === 'image/webp') {
        return 'webp';
    }
    return 'png';
}

function workspaceLink(relativePath: string) {
    const encoded = relativePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    return `grotto://workspace/${encoded}`;
}
