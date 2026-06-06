import type { CortexProcessorInput } from './source-import';

export async function transcribeWithOpenAi(options: {
    apiKey: string | null;
    input: CortexProcessorInput;
}): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    const { input } = options;
    const apiKey = options.apiKey?.trim();
    const model = openAiModelFromRef(input.modelRef);
    if (!(apiKey && input.rawBytes)) {
        throw new Error(
            `Cortex ${input.kind} import requires raw bytes and OpenAI API access for transcription.`
        );
    }
    const form = new FormData();
    form.append(
        'file',
        new Blob([input.rawBytes], { type: input.mediaType }),
        input.rawFileName ?? 'media.bin'
    );
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        body: form,
        headers: { authorization: `Bearer ${apiKey}` },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(
            `Cortex transcription failed (${response.status}): ${await response.text()}`
        );
    }
    const data = (await response.json()) as { text?: string };
    const content = data.text?.trim();
    if (!content) {
        throw new Error('Cortex transcription returned no text.');
    }
    return { content, metadata: { model, modelRef: input.modelRef, provider: 'openai' } };
}

export async function ocrImageWithOpenAi(options: {
    apiKey: string | null;
    input: CortexProcessorInput;
}): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    const { input } = options;
    const apiKey = options.apiKey?.trim();
    const model = openAiModelFromRef(input.modelRef);
    if (!(apiKey && input.rawBytes)) {
        throw new Error(
            `Cortex ${input.kind} import requires raw bytes and OpenAI API access for OCR.`
        );
    }
    const mediaType = input.mediaType ?? 'image/png';
    const response = await fetch('https://api.openai.com/v1/responses', {
        body: JSON.stringify({
            input: [
                {
                    content: [
                        {
                            text: 'Extract visible text from this image. Return only text, no commentary.',
                            type: 'input_text',
                        },
                        {
                            image_url: `data:${mediaType};base64,${Buffer.from(input.rawBytes).toString('base64')}`,
                            type: 'input_image',
                        },
                    ],
                    role: 'user',
                },
            ],
            model,
        }),
        headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(`Cortex OCR failed (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as OpenAiResponsePayload;
    const content = extractOpenAiResponseText(data);
    if (!content) {
        throw new Error('Cortex OCR returned no text.');
    }
    return { content, metadata: { model, modelRef: input.modelRef, provider: 'openai' } };
}

interface OpenAiResponsePayload {
    output?: Array<{
        content?: Array<{
            text?: string;
            type?: string;
        }>;
    }>;
    output_text?: string;
}

function extractOpenAiResponseText(data: OpenAiResponsePayload): string | null {
    const direct = data.output_text?.trim();
    if (direct) {
        return direct;
    }
    const nested = data.output
        ?.flatMap((item) => item.content ?? [])
        .map((content) => content.text?.trim() ?? '')
        .find((text) => text.length > 0);
    return nested ?? null;
}

function openAiModelFromRef(modelRef: string | undefined): string {
    const [provider, model] = modelRef?.split(/\/(.+)/u) ?? [];
    if (provider !== 'openai' || !model) {
        throw new Error(`Cortex import requires an OpenAI model ref, got ${modelRef ?? 'none'}.`);
    }
    return model;
}
