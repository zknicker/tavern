import { createOpenAI } from '@ai-sdk/openai';
import type { ToolSet } from '@ai-sdk/provider-utils';
import { type LanguageModel, streamText } from 'ai';
import {
    codexSignInExpiredReason,
    refreshCodexCredentialsIfNeeded,
} from '../model-access/codex-oauth-refresh.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';

const codexResponsesBaseUrl = 'https://chatgpt.com/backend-api/codex';
const codexResponsesModel = 'gpt-5.5';
const supportedSizes = new Set(['auto', '1024x1024', '1024x1536', '1536x1024']);

type CodexOpenAi = ReturnType<typeof createOpenAI>;
type CodexImageSize = 'auto' | '1024x1024' | '1024x1536' | '1536x1024';

interface GenerateTextBoundaryInput {
    model: LanguageModel;
    openai: CodexOpenAi;
    prompt: string;
    size?: CodexImageSize;
}

interface GenerateTextBoundaryResult {
    staticToolResults: Array<{ output: unknown; toolName: string }>;
}

type GenerateTextBoundary = (
    input: GenerateTextBoundaryInput
) => Promise<GenerateTextBoundaryResult>;

interface CodexImageGenerationDependencies {
    fetch: typeof fetch;
    generateText: GenerateTextBoundary;
    now: () => Date;
}

const defaultDependencies: CodexImageGenerationDependencies = {
    fetch: globalThis.fetch,
    generateText: async (input) => {
        const imageGenerationTool = input.openai.tools.imageGeneration({
            outputFormat: 'png',
            ...(input.size ? { size: input.size } : {}),
        });
        // The Codex Responses backend accepts only streaming, unstored calls
        // ("Stream must be set to true" / "Store must be set to false").
        const stream = streamText({
            model: input.model,
            prompt: input.prompt,
            providerOptions: { openai: { store: false } },
            toolChoice: { toolName: 'image_generation', type: 'tool' },
            tools: {
                // @ai-sdk/openai and ai currently resolve adjacent provider-utils patch versions.
                image_generation: imageGenerationTool as unknown as ToolSet[string],
            },
        });
        await stream.consumeStream({ onError: rethrow });
        return { staticToolResults: [...(await stream.staticToolResults)] };
    },
    now: () => new Date(),
};

let dependencies = defaultDependencies;

export function setCodexImageGenerationDependenciesForTesting(
    overrides: Partial<CodexImageGenerationDependencies>
) {
    const previous = dependencies;
    dependencies = { ...dependencies, ...overrides };
    return () => {
        dependencies = previous;
    };
}

export async function generateCodexImage(input: {
    prompt: string;
    size?: string;
}): Promise<{ mediaType: 'image/png'; uint8Array: Uint8Array }> {
    const loaded = await loadVaultBackedCodexCredentials();
    if (!loaded) {
        throw new Error('Connect Codex in Model access to use subscription image generation.');
    }
    const refreshed = await refreshCodexCredentialsIfNeeded(loaded, {
        fetch: dependencies.fetch,
        now: dependencies.now(),
    });
    if (!refreshed.credentials.accountId) {
        throw new Error('Codex sign-in has no account id; re-connect Codex in Model access.');
    }

    const openai = createOpenAI({
        apiKey: refreshed.credentials.accessToken,
        baseURL: codexResponsesBaseUrl,
        headers: { 'chatgpt-account-id': refreshed.credentials.accountId },
    });
    const size = supportedSizes.has(input.size ?? '') ? (input.size as CodexImageSize) : undefined;

    let result: GenerateTextBoundaryResult;
    try {
        result = await dependencies.generateText({
            model: openai.responses(codexResponsesModel),
            openai,
            prompt: `Generate the image described by the user.\n\n${input.prompt}`,
            ...(size ? { size } : {}),
        });
    } catch (error) {
        if (readHttpStatus(error) === 401) {
            throw new Error(codexSignInExpiredReason, { cause: error });
        }
        throw new Error(`Codex image generation failed: ${errorMessage(error)}`, { cause: error });
    }

    const imageResult = result.staticToolResults.find(
        (toolResult) => toolResult.toolName === 'image_generation'
    );
    const base64 = readImageBase64(imageResult?.output);
    if (!base64) {
        throw new Error('Codex image generation returned no image payload.');
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0) {
        throw new Error('Codex image generation returned an empty image payload.');
    }

    return { mediaType: 'image/png', uint8Array: new Uint8Array(bytes) };
}

function readImageBase64(output: unknown) {
    return output &&
        typeof output === 'object' &&
        'result' in output &&
        typeof output.result === 'string'
        ? output.result
        : null;
}

function readHttpStatus(error: unknown): number | null {
    if (!(error && typeof error === 'object')) {
        return null;
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
        return error.statusCode;
    }
    return 'status' in error && typeof error.status === 'number' ? error.status : null;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function rethrow(error: unknown): never {
    throw error;
}
