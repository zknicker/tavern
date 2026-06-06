import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { generateStaleCortexEmbeddings } from './embeddings';
import { getCortexPage, recallCortex, searchCortex } from './read';
import { resolveCortexOpenAiApiKey, saveCortexSettings } from './settings';
import { syncCortexMarkdown } from './sync';

const sourceDocument = {
    locator: 'https://www.w3.org/WAI/fundamentals/accessibility-principles/',
    title: 'W3C Accessibility Principles',
};

describe('Cortex live verify smoke', () => {
    let workPath: string;
    let wikiPath: string;

    beforeEach(async () => {
        workPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-live-verify-'));
        wikiPath = path.join(workPath, 'wiki');
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(workPath, 'empty-codex-home');
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
        await saveCortexSettings(getCortexDb(), {
            embedding: {
                model: 'text-embedding-3-small',
                modelRef: 'openai/text-embedding-3-small',
                provider: 'openai',
            },
            recall: { mode: 'balanced' },
        });
    });

    afterEach(async () => {
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(workPath, { force: true, recursive: true });
    });

    test('syncs a source-backed markdown edit and recalls it through real OpenAI embeddings', async () => {
        const pagePath = path.join(wikiPath, 'reference', 'accessibility-principles.md');
        await mkdir(path.dirname(pagePath), { recursive: true });
        const initialTruth = await distillKnowledgeDocument();
        await writeFile(pagePath, knowledgePageMarkdown(initialTruth));

        const firstSync = await syncCortexMarkdown(getCortexDb());
        const firstEmbeddings = await generateStaleCortexEmbeddings(
            getCortexDb(),
            '2026-06-05T00:00:00.000Z'
        );
        const firstSearch = await searchCortex(getCortexDb(), {
            limit: 5,
            query: 'perceivable operable understandable robust',
        });

        const updatedTruth = await distillKnowledgeDocument({
            extraInstruction:
                'Also include this durable Tavern UI review note: keyboard focus order, visible labels, and robust semantic structure.',
        });
        await writeFile(pagePath, knowledgePageMarkdown(updatedTruth));
        const secondSync = await syncCortexMarkdown(getCortexDb());
        const secondEmbeddings = await generateStaleCortexEmbeddings(
            getCortexDb(),
            '2026-06-05T00:05:00.000Z'
        );
        const secondSearch = await searchCortex(getCortexDb(), {
            explain: true,
            limit: 5,
            query: 'keyboard focus order labels Tavern UI reviews',
        });
        const recall = await recallCortex(getCortexDb(), {
            limit: 5,
            mode: 'balanced',
            query: 'What accessibility guidance should Tavern remember for UI reviews?',
        });
        const page = await getCortexPage(getCortexDb(), 'reference/accessibility-principles');

        expect(firstSync.pagesSynced).toBe(1);
        expect(firstEmbeddings.length).toBeGreaterThan(0);
        expect(firstEmbeddings.every((record) => record.provider === 'openai')).toBe(true);
        expect(firstSearch.hits.some((hit) => hit.page.slug === page?.slug)).toBe(true);
        expect(secondSync.pagesSynced).toBe(1);
        expect(secondEmbeddings.length).toBeGreaterThan(0);
        expect(secondEmbeddings.every((record) => record.provider === 'openai')).toBe(true);
        expect(page?.compiledTruth).toContain('keyboard focus order');
        expect(secondSearch.hits[0]?.page.slug).toBe(page?.slug);
        expect(recall.hits.some((hit) => hit.page.slug === page?.slug)).toBe(true);

        const summary = {
            input: {
                markdown: await readFile(pagePath, 'utf8'),
                sourceDocument,
            },
            output: {
                distilledTruth: updatedTruth,
                distillationModel: 'gpt-4o-mini',
                firstEmbeddingCount: firstEmbeddings.length,
                firstSearchHits: firstSearch.hits.map((hit) => hit.page.slug),
                pageSlug: page?.slug,
                recallHits: recall.hits.map((hit) => hit.page.slug),
                secondEmbeddingCount: secondEmbeddings.length,
                secondSearchHits: secondSearch.hits.map((hit) => ({
                    score: hit.score,
                    slug: hit.page.slug,
                })),
                syncedPages: secondSync.pagesSynced,
            },
        };

        if (process.env.TAVERN_CORTEX_VERIFY_SMOKE_OUTPUT) {
            await writeFile(
                process.env.TAVERN_CORTEX_VERIFY_SMOKE_OUTPUT,
                `${JSON.stringify(summary, null, 2)}\n`
            );
        }
    }, 120_000);
});

function knowledgePageMarkdown(compiledTruth: string): string {
    return `---
id: ctxp_verify_accessibility_principles
title: Accessibility Principles Smoke
slug: reference/accessibility-principles
type: reference
status: active
tags: ["accessibility", "smoke"]
source_refs: [{"id":"ctxs_w3c_accessibility_principles","kind":"article","locator":"${sourceDocument.locator}"}]
---
# Accessibility Principles Smoke

## Compiled Truth
${compiledTruth}

## Body
Source-backed knowledge document for Cortex verification based on ${sourceDocument.title}.

## Timeline
### 2026-06-05T00:00:00.000Z
Captured the source-backed accessibility principles summary for live Cortex verification.
`;
}

async function distillKnowledgeDocument(options?: { extraInstruction?: string }): Promise<string> {
    const apiKey = await resolveCortexOpenAiApiKey();
    if (!apiKey) {
        throw new Error(
            'Cortex verify smoke requires OPENAI_API_KEY or Tavern Vault OpenAI access.'
        );
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
        body: JSON.stringify({
            input: [
                {
                    content: [
                        {
                            text: [
                                'Distill this source-backed knowledge document into one durable Cortex compiled-truth paragraph.',
                                'Return only the paragraph. Keep it under 70 words. Include the exact phrase "perceivable, operable, understandable, and robust".',
                                options?.extraInstruction
                                    ? `Include the exact phrase "keyboard focus order". ${options.extraInstruction}`
                                    : '',
                                `Source title: ${sourceDocument.title}`,
                                `Source URL: ${sourceDocument.locator}`,
                                'Source notes: W3C presents accessibility through perceivable information, operable interfaces, understandable content, and robust implementation that works across assistive technologies.',
                            ]
                                .filter(Boolean)
                                .join('\n'),
                            type: 'input_text',
                        },
                    ],
                    role: 'user',
                },
            ],
            model: 'gpt-4o-mini',
            temperature: 0,
        }),
        headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(
            `Cortex verify distillation failed (${response.status}): ${await response.text()}`
        );
    }
    const text = extractOpenAiResponseText((await response.json()) as OpenAiResponsePayload);
    if (!text) {
        throw new Error('Cortex verify distillation returned no text.');
    }
    return text;
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
