import { describe, expect, it } from 'bun:test';
import {
    cortexAddSchemaTermInputSchema,
    cortexDreamReportListSchema,
    cortexImportInputSchema,
    cortexImportResultSchema,
    cortexIngestInputSchema,
    cortexIngestResultSchema,
    cortexPageVersionListSchema,
    cortexSaveSchemaInputSchema,
    cortexSaveSettingsSchema,
    cortexSchemaAdditionListSchema,
    cortexSchemaRecordSchema,
    cortexSearchResultSchema,
    cortexSettingsSchema,
} from './contracts.js';
import { defaultCortexSchema } from './cortex-defaults.js';

describe('Cortex runtime contracts', () => {
    it('validates editable schema definitions', () => {
        const input = cortexSaveSchemaInputSchema.parse({
            schema: {
                frontmatterMappings: [
                    { fields: ['platforms'], linkType: 'uses', pageType: 'product' },
                ],
                linkTypes: [{ name: 'mentions' }, { name: 'uses' }],
                name: 'business-schema',
                pageTypes: ['product', 'note'],
                version: 1,
            },
        });

        expect(input.schema.frontmatterMappings[0]?.linkType).toBe('uses');
    });

    it('validates active schema records returned by Runtime', () => {
        expect(
            cortexSchemaRecordSchema.parse({
                createdAt: '2026-05-28T12:00:00.000Z',
                id: 'ctxschema_1',
                schema: {
                    frontmatterMappings: [],
                    linkTypes: [{ name: 'mentions' }],
                    name: 'business-schema',
                    pageTypes: ['note'],
                    version: 1,
                },
                status: 'active',
                updatedAt: '2026-05-28T12:00:00.000Z',
            }).schema.name
        ).toBe('business-schema');
    });

    it('validates runtime-added schema terms surfaced for review', () => {
        const input = cortexAddSchemaTermInputSchema.parse({
            example: { title: 'Podcast Breakdown' },
            kind: 'page-type',
            name: 'podcast-episode',
            reason: 'A Cortex capture introduced a new page type.',
            sourceRefs: [{ id: 'msg-1', kind: 'message' }],
        });

        expect(input.kind).toBe('page-type');
        expect(
            cortexSchemaAdditionListSchema.parse({
                additions: [
                    {
                        createdAt: '2026-06-04T12:00:00.000Z',
                        example: input.example,
                        id: 'ctxterm_1',
                        kind: input.kind,
                        name: input.name,
                        reason: input.reason,
                        sourceRefs: input.sourceRefs,
                        updatedAt: '2026-06-04T12:00:00.000Z',
                        usageCount: 2,
                    },
                ],
            }).additions[0]?.name
        ).toBe('podcast-episode');
    });

    it('validates source ingest input and Runtime results', () => {
        const input = cortexIngestInputSchema.parse({
            content: 'A source note becomes searchable Cortex material.',
            kind: 'article',
            locator: 'https://example.com/source-note',
            metadata: { author: 'Example' },
            tags: ['source'],
            title: 'Source Note',
        });

        expect(input).toMatchObject({
            kind: 'article',
            locator: 'https://example.com/source-note',
            metadata: { author: 'Example' },
            tags: ['source'],
            title: 'Source Note',
            type: 'source',
        });

        expect(
            cortexIngestResultSchema.parse({
                auditId: 'ctxa_1',
                page: {
                    aliases: [],
                    body: 'A source note becomes searchable Cortex material.',
                    claims: [],
                    compiledTruth: 'A source note becomes searchable Cortex material.',
                    createdAt: '2026-06-05T12:00:00.000Z',
                    frontmatter: {},
                    id: 'ctxp_1',
                    indexing: {
                        chunkCount: 1,
                        currentEmbeddingCount: 0,
                        embeddingModel: 'text-embedding-3-small',
                        embeddingProvider: 'openai',
                        lastEmbeddedAt: null,
                        missingEmbeddingCount: 1,
                        staleEmbeddingCount: 0,
                        status: 'needs-indexing',
                    },
                    links: [],
                    slug: 'source-note',
                    sourceRefs: [{ id: 'ctxs_1', kind: 'article', locator: input.locator }],
                    status: 'active',
                    tags: ['source'],
                    timeline: [],
                    title: 'Source Note',
                    type: 'source',
                    updatedAt: '2026-06-05T12:00:00.000Z',
                },
                sourceRef: {
                    id: 'ctxs_1',
                    kind: 'article',
                    locator: input.locator,
                },
            }).page.slug
        ).toBe('source-note');
    });

    it('validates media import input and Runtime results', () => {
        const input = cortexImportInputSchema.parse({
            kind: 'podcast',
            locator: 'fixture:podcast',
            mediaType: 'audio/mpeg',
            metadata: { creator: 'Example' },
            rawContentBase64: Buffer.from('audio bytes').toString('base64'),
            rawFileName: 'podcast.mp3',
            title: 'Podcast Source',
        });

        expect(input).toMatchObject({
            kind: 'podcast',
            locator: 'fixture:podcast',
            mediaType: 'audio/mpeg',
            metadata: { creator: 'Example' },
            rawFileName: 'podcast.mp3',
            tags: [],
            title: 'Podcast Source',
        });

        expect(
            cortexImportResultSchema.parse({
                auditId: 'ctxa_1',
                files: [
                    {
                        hash: 'sha256',
                        id: 'ctxf_1',
                        mediaType: 'audio/mpeg',
                        metadata: {},
                        path: '.raw/podcast-source/podcast.mp3',
                    },
                ],
                importKind: 'podcast',
                normalizedContent: 'Podcast transcript.',
                page: {
                    aliases: [],
                    body: 'Podcast transcript.',
                    claims: [],
                    compiledTruth: 'Podcast transcript.',
                    createdAt: '2026-06-05T12:00:00.000Z',
                    frontmatter: {},
                    id: 'ctxp_1',
                    indexing: {
                        chunkCount: 1,
                        currentEmbeddingCount: 0,
                        embeddingModel: 'text-embedding-3-small',
                        embeddingProvider: 'openai',
                        lastEmbeddedAt: null,
                        missingEmbeddingCount: 1,
                        staleEmbeddingCount: 0,
                        status: 'needs-indexing',
                    },
                    links: [],
                    slug: 'podcast-source',
                    sourceRefs: [{ id: 'ctxs_1', kind: 'podcast', locator: input.locator }],
                    status: 'active',
                    tags: ['import', 'podcast'],
                    timeline: [],
                    title: 'Podcast Source',
                    type: 'podcast',
                    updatedAt: '2026-06-05T12:00:00.000Z',
                },
                sourceRef: { id: 'ctxs_1', kind: 'podcast', locator: input.locator },
            }).importKind
        ).toBe('podcast');
    });

    it('validates structured Cortex Dream reports', () => {
        const parsed = cortexDreamReportListSchema.parse({
            reports: [
                {
                    completedAt: '2026-06-05T13:05:00.000Z',
                    durationMs: 1250,
                    estimatedCostUsd: 0.000_42,
                    healthAfter: {
                        counts: { 'orphan-page': 1 },
                        issueCount: 1,
                        score: 96,
                    },
                    healthBefore: {
                        counts: { 'missing-cross-reference': 2, 'orphan-page': 2 },
                        issueCount: 4,
                        score: 84,
                    },
                    id: 'ctxdream_1',
                    items: [
                        {
                            createdAt: '2026-06-05T13:04:00.000Z',
                            id: 'ctxdreamitem_1',
                            kind: 'pattern-created',
                            metadata: { type: 'pattern' },
                            pageId: null,
                            pageSlug: 'daily-design-pattern',
                            summary: 'Detected a recurring design workflow pattern.',
                            title: 'Daily Design Pattern',
                        },
                    ],
                    model: 'gpt-5.5',
                    noops: [],
                    phases: [
                        {
                            durationMs: 10,
                            metadata: {},
                            name: 'Final health',
                            status: 'success',
                            summary: 'Lint complete.',
                        },
                    ],
                    provider: 'openai-codex',
                    startedAt: '2026-06-05T13:00:00.000Z',
                    status: 'success',
                    summary: 'Reviewed 12 Cortex work items.',
                    warnings: ['One ambiguous citation was skipped.'],
                },
            ],
        });

        expect(parsed.reports[0]?.items[0]?.kind).toBe('pattern-created');
        expect(parsed.reports[0]?.healthAfter?.score).toBe(96);
    });

    it('validates Cortex model settings for import processors', () => {
        expect(
            cortexSaveSettingsSchema.parse({
                embedding: {
                    model: 'text-embedding-3-small',
                    modelRef: 'openai/text-embedding-3-small',
                    provider: 'openai',
                },
                models: {
                    audioTranscription: 'openai/whisper-1',
                    chatIngestion: 'openai-codex/gpt-5.5',
                    dream: 'openai-codex/gpt-5.5',
                    ocr: 'openai/gpt-4o-mini',
                    queryExpansion: 'openrouter/google/gemini-2.5-flash-lite',
                },
            }).models
        ).toMatchObject({
            audioTranscription: 'openai/whisper-1',
            ocr: 'openai/gpt-4o-mini',
        });

        expect(
            cortexSettingsSchema.parse({
                embedding: {
                    apiKey: null,
                    apiKeyConfigured: true,
                    apiKeySource: 'runtime-settings',
                    dimensions: 1536,
                    model: 'text-embedding-3-small',
                    modelRef: 'openai/text-embedding-3-small',
                    provider: 'openai',
                    updatedAt: null,
                },
                models: {
                    audioTranscription: 'openai/whisper-1',
                    chatIngestion: 'openai-codex/gpt-5.5',
                    dream: 'openai-codex/gpt-5.5',
                    embedding: 'openai/text-embedding-3-small',
                    ocr: 'openai/gpt-4o-mini',
                    queryExpansion: 'openrouter/google/gemini-2.5-flash-lite',
                },
                recall: {
                    mode: 'balanced',
                    updatedAt: null,
                },
            }).models.ocr
        ).toBe('openai/gpt-4o-mini');
    });

    it('validates page version history and search diagnostics', () => {
        expect(
            cortexPageVersionListSchema.parse({
                slug: 'versioned-page',
                versions: [
                    {
                        contentHash: 'hash-1',
                        createdAt: '2026-06-04T12:00:00.000Z',
                        id: 'ctxv_1',
                        pageId: 'ctxp_1',
                        pageUpdatedAt: '2026-06-04T12:00:00.000Z',
                        slug: 'versioned-page',
                        status: 'active',
                        title: 'Versioned Page',
                        type: 'note',
                        versionNumber: 1,
                    },
                ],
            }).versions[0]?.versionNumber
        ).toBe(1);

        expect(
            cortexSearchResultSchema.parse({
                diagnostics: {
                    explain: true,
                    limit: 10,
                    offset: 0,
                    returnedCount: 1,
                    totalHitCount: 1,
                },
                hits: [
                    {
                        diagnostics: {
                            createSafety: 'exists',
                            evidence: ['lexical'],
                            finalScore: 2,
                            lexicalScore: 2,
                            matchedAliases: [],
                            rank: 1,
                            vectorScore: null,
                        },
                        page: {
                            aliases: [],
                            id: 'ctxp_1',
                            slug: 'versioned-page',
                            status: 'active',
                            tags: [],
                            title: 'Versioned Page',
                            type: 'note',
                            updatedAt: '2026-06-04T12:00:00.000Z',
                        },
                        score: 2,
                        snippet: 'Versioned page.',
                    },
                ],
                limit: 10,
                offset: 0,
                query: 'versioned page',
                vectorDegradedReason: null,
            }).hits[0]?.diagnostics?.rank
        ).toBe(1);
    });

    it('keeps the managed default schema aligned with creator-commerce memory', () => {
        const pageTypes = new Set<string>(defaultCortexSchema.pageTypes);
        const linkTypes = new Set(defaultCortexSchema.linkTypes.map((type) => type.name));

        expect(pageTypes.has('production-partner')).toBe(true);
        expect(pageTypes.has('niche')).toBe(true);
        expect(pageTypes.has('supplier')).toBe(false);
        expect(pageTypes.has('listing')).toBe(true);
        expect(pageTypes.has('design')).toBe(true);
        expect(pageTypes.has('investment')).toBe(true);
        expect(pageTypes.has('automation')).toBe(true);
        expect(pageTypes.has('preference')).toBe(true);

        expect(linkTypes.has('produced_by')).toBe(true);
        expect(linkTypes.has('targets_niche')).toBe(true);
        expect(linkTypes.has('sells_on')).toBe(true);
        expect(linkTypes.has('supports_thesis')).toBe(true);
        expect(linkTypes.has('prefers')).toBe(true);

        for (const mapping of defaultCortexSchema.frontmatterMappings) {
            expect(linkTypes.has(mapping.linkType)).toBe(true);
        }
    });
});
