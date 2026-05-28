import type { Database } from '../db/sqlite';
import { getCortexEmbeddingConfig } from './settings';

export interface CortexEmbedding {
    dimensions: number;
    model: string;
    provider: string;
    vector: number[];
}

export async function embedCortexText(db: Database, text: string): Promise<CortexEmbedding | null> {
    const config = getCortexEmbeddingConfig(db);
    if (!config.apiKey) {
        return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        body: JSON.stringify({
            input: text,
            model: config.model,
        }),
        headers: {
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(await formatOpenAiEmbeddingError(response));
    }

    const body = (await response.json()) as {
        data?: Array<{ embedding?: unknown }>;
    };
    const vector = body.data?.[0]?.embedding;
    if (!(Array.isArray(vector) && vector.every((value) => typeof value === 'number'))) {
        throw new Error('OpenAI embedding response did not include a numeric embedding.');
    }

    return {
        dimensions: vector.length,
        model: config.model,
        provider: config.provider,
        vector,
    };
}

async function formatOpenAiEmbeddingError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: { code?: unknown; message?: unknown; type?: unknown };
    } | null;
    const message = typeof body?.error?.message === 'string' ? body.error.message : null;
    const code = typeof body?.error?.code === 'string' ? body.error.code : null;
    const type = typeof body?.error?.type === 'string' ? body.error.type : null;
    const detail = [code, type].filter(Boolean).join('/');

    if (message) {
        return detail
            ? `OpenAI embedding request failed (${response.status}, ${detail}): ${message}`
            : `OpenAI embedding request failed (${response.status}): ${message}`;
    }

    return `OpenAI embedding request failed (${response.status}).`;
}
