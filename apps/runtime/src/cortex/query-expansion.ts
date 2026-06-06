import type { CortexSearchResult } from '@tavern/api';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings';

export const cortexQueryExpansionModel = 'google/gemini-2.5-flash-lite';

interface QueryExpansionInput {
    hits: CortexSearchResult['hits'];
    modelRef: string;
    query: string;
}

interface OpenRouterChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: unknown;
        };
    }>;
}

export async function expandCortexRecallQuery(input: QueryExpansionInput): Promise<string[]> {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        return [];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        body: JSON.stringify({
            max_tokens: 300,
            messages: [
                {
                    content:
                        'Generate concise alternate search queries for a local knowledgebase recall system. Return only JSON: {"queries":["..."]}.',
                    role: 'system',
                },
                {
                    content: JSON.stringify({
                        existingHits: input.hits.slice(0, 5).map((hit) => ({
                            score: hit.score,
                            snippet: hit.snippet,
                            title: hit.page.title,
                            type: hit.page.type,
                        })),
                        query: input.query,
                    }),
                    role: 'user',
                },
            ],
            model: parseModelRef(input.modelRef).model,
            temperature: 0,
        }),
        headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'HTTP-Referer': 'https://tavern.local',
            'X-Title': 'Tavern Cortex',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(await formatOpenRouterError(response));
    }

    const body = (await response.json()) as OpenRouterChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
        throw new Error('OpenRouter query expansion response did not include text content.');
    }

    return normalizeExpandedQueries(input.query, readExpandedQueries(content));
}

function parseModelRef(modelRef: string) {
    const separatorIndex = modelRef.indexOf('/');
    return {
        model: separatorIndex >= 0 ? modelRef.slice(separatorIndex + 1) : modelRef,
        provider: separatorIndex >= 0 ? modelRef.slice(0, separatorIndex) : 'openrouter',
    };
}

function normalizeExpandedQueries(originalQuery: string, queries: unknown): string[] {
    if (!Array.isArray(queries)) {
        return [];
    }
    const original = normalizeQuery(originalQuery);
    const seen = new Set([original]);
    const normalized: string[] = [];
    for (const query of queries) {
        if (typeof query !== 'string') {
            continue;
        }
        const trimmed = query.trim().replace(/\s+/gu, ' ');
        const key = normalizeQuery(trimmed);
        if (!(trimmed && key && !seen.has(key))) {
            continue;
        }
        normalized.push(trimmed);
        seen.add(key);
        if (normalized.length >= 3) {
            break;
        }
    }
    return normalized;
}

function readExpandedQueries(content: string): unknown {
    const direct = parseJson(content);
    if (direct) {
        return direct.queries;
    }

    const match = content.match(/\{[\s\S]*\}/u);
    const extracted = match ? parseJson(match[0]) : null;
    return extracted?.queries;
}

function parseJson(content: string): { queries?: unknown } | null {
    try {
        const parsed = JSON.parse(content) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as { queries?: unknown }) : null;
    } catch {
        return null;
    }
}

function normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/gu, ' ');
}

async function formatOpenRouterError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
    } | null;
    const message = typeof body?.error?.message === 'string' ? body.error.message : null;
    return message
        ? `OpenRouter query expansion failed (${response.status}): ${message}`
        : `OpenRouter query expansion failed (${response.status}).`;
}
