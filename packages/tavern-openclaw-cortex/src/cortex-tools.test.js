import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerTavernCortexTools, TAVERN_CORTEX_TOOL_NAMES } from './cortex-tools.js';

describe('Tavern Cortex OpenClaw tools', () => {
    it('declares the registered tools in the OpenClaw manifest', () => {
        expect(readManifestToolNames()).toEqual(TAVERN_CORTEX_TOOL_NAMES);
    });

    it('registers all declared Cortex tools', () => {
        const tools = [];

        registerTavernCortexTools(
            {
                registerTool: (tool) => tools.push(tool),
            },
            {
                baseUrl: 'http://runtime.test',
                fetch: mockFetch({}),
            }
        );

        expect(tools.map((tool) => tool.name)).toEqual(TAVERN_CORTEX_TOOL_NAMES);
    });

    it('calls Cortex search through the Tavern runtime API', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({ hits: [], query: 'project memory' });
            }),
        });

        const result = await tools.get('cortex_search').execute('call_1', {
            limit: 5,
            query: 'project memory',
        });

        expect(requests).toEqual([
            {
                body: {
                    limit: 5,
                    query: 'project memory',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/search',
            },
        ]);
        expect(JSON.parse(result.content[0].text)).toEqual({ hits: [], query: 'project memory' });
    });

    it('calls Cortex recall with an explicit search mode', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({ hits: [], mode: 'tokenmax', query: 'project memory' });
            }),
        });

        await tools.get('cortex_recall').execute('call_1', {
            limit: 20,
            mode: 'tokenmax',
            query: 'project memory',
        });

        expect(requests).toEqual([
            {
                body: {
                    limit: 20,
                    mode: 'tokenmax',
                    query: 'project memory',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/recall',
            },
        ]);
    });

    it('describes current default Cortex page types without rejecting schema extensions', () => {
        const tools = registerTools({ fetch: mockFetch({}) });
        const captureType = tools.get('cortex_capture').parameters.properties.type;

        expect(captureType.type).toBe('string');
        expect(captureType.description).toContain('product');
        expect(captureType.description).toContain('niche');
        expect(captureType.description).toContain('production-partner');
        expect(captureType.description).toContain('campaign');
        expect(captureType.description).toContain('metric');
    });

    it('captures Cortex pages with a default OpenClaw agent source', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({
                    auditId: 'ctxa_1',
                    page: {
                        id: 'ctxp_1',
                        slug: 'stable-memory',
                        title: 'Stable memory',
                    },
                });
            }),
        });

        await tools.get('cortex_capture').execute('call_1', {
            content: 'The durable brain is Cortex.',
            tags: ['memory'],
            title: 'Stable memory',
            type: 'fact',
        });

        expect(requests).toEqual([
            {
                body: {
                    content: 'The durable brain is Cortex.',
                    source: {
                        actorId: 'openclaw-agent',
                        actorKind: 'agent',
                    },
                    tags: ['memory'],
                    title: 'Stable memory',
                    type: 'fact',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/capture',
            },
        ]);
    });

    it('edits Cortex pages through the Tavern runtime API', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({
                    auditId: 'ctxa_1',
                    pages: [
                        {
                            body: 'Useful source body.',
                            claims: [],
                            compiledTruth: 'Useful source truth.',
                            createdAt: '2026-01-01T00:00:00.000Z',
                            frontmatter: {},
                            id: 'ctxp_1',
                            indexing: {
                                chunkCount: 0,
                                currentEmbeddingCount: 0,
                                embeddingModel: 'text-embedding-3-small',
                                embeddingProvider: 'openai',
                                lastEmbeddedAt: null,
                                missingEmbeddingCount: 0,
                                staleEmbeddingCount: 0,
                                status: 'not-indexed',
                            },
                            links: [],
                            slug: 'useful-source',
                            sourceRefs: [],
                            status: 'active',
                            timeline: [],
                            title: 'Useful Source',
                            type: 'source',
                            updatedAt: '2026-01-01T00:00:00.000Z',
                        },
                    ],
                });
            }),
        });

        await tools.get('cortex_edit').execute('call_1', {
            action: 'upsert',
            body: 'Useful source body.',
            compiledTruth: 'Useful source truth.',
            links: [{ linkKind: 'mentions', targetSlug: 'shopjoyhaus' }],
            summary: 'Enriched source page.',
            tags: ['source'],
            title: 'Useful Source',
            type: 'source',
        });

        expect(requests).toEqual([
            {
                body: {
                    action: 'upsert',
                    aliases: [],
                    body: 'Useful source body.',
                    claims: [],
                    compiledTruth: 'Useful source truth.',
                    frontmatter: {},
                    links: [{ linkKind: 'mentions', targetSlug: 'shopjoyhaus' }],
                    source: {
                        actorId: 'openclaw-agent',
                        actorKind: 'agent',
                    },
                    summary: 'Enriched source page.',
                    tags: ['source'],
                    timelineEntries: [],
                    title: 'Useful Source',
                    type: 'source',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/edit',
            },
        ]);
    });

    it('ingests normalized source text through the Tavern runtime API', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({
                    auditId: 'ctxa_1',
                    page: {
                        id: 'ctxp_1',
                        slug: 'article-source',
                        title: 'Article Source',
                    },
                    sourceRef: {
                        id: 'ctxs_1',
                        kind: 'article',
                        locator: 'https://example.com/article',
                    },
                });
            }),
        });

        await tools.get('cortex_ingest').execute('call_1', {
            content: 'Durable source text.',
            kind: 'article',
            locator: 'https://example.com/article',
            metadata: {
                author: 'A Writer',
            },
            tags: ['source'],
            title: 'Article Source',
            type: 'source',
        });

        expect(requests).toEqual([
            {
                body: {
                    actor: {
                        actorId: 'openclaw-agent',
                        actorKind: 'agent',
                    },
                    content: 'Durable source text.',
                    kind: 'article',
                    locator: 'https://example.com/article',
                    metadata: {
                        author: 'A Writer',
                    },
                    tags: ['source'],
                    title: 'Article Source',
                    type: 'source',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/ingest',
            },
        ]);
    });

    it('imports media sources through the Tavern runtime API', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({
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
                    normalizedContent: 'Transcript text.',
                    page: {
                        id: 'ctxp_1',
                        slug: 'podcast-source',
                        title: 'Podcast Source',
                    },
                    sourceRef: {
                        id: 'ctxs_1',
                        kind: 'podcast',
                        locator: 'fixture:podcast',
                    },
                });
            }),
        });

        await tools.get('cortex_import').execute('call_1', {
            kind: 'podcast',
            locator: 'fixture:podcast',
            mediaType: 'audio/mpeg',
            rawContentBase64: 'YXVkaW8=',
            rawFileName: 'podcast.mp3',
            tags: ['source'],
            title: 'Podcast Source',
            type: 'podcast',
        });

        expect(requests).toEqual([
            {
                body: {
                    actor: {
                        actorId: 'openclaw-agent',
                        actorKind: 'agent',
                    },
                    kind: 'podcast',
                    locator: 'fixture:podcast',
                    mediaType: 'audio/mpeg',
                    metadata: {},
                    rawContentBase64: 'YXVkaW8=',
                    rawFileName: 'podcast.mp3',
                    tags: ['source'],
                    title: 'Podcast Source',
                    type: 'podcast',
                },
                method: 'POST',
                url: 'http://runtime.test/cortex/import',
            },
        ]);
    });

    it('reads backlinks with a GET route', async () => {
        const requests = [];
        const tools = registerTools({
            fetch: mock(async (url, init) => {
                requests.push({ method: init.method, url: String(url) });
                return jsonResponse({ ok: true });
            }),
        });

        await tools.get('cortex_list_backlinks').execute('call_1', { target: 'Project Memory' });

        expect(requests).toEqual([
            {
                method: 'GET',
                url: 'http://runtime.test/cortex/pages/Project%20Memory/backlinks',
            },
        ]);
    });
});

function registerTools(options) {
    const tools = new Map();

    registerTavernCortexTools(
        {
            registerTool: (tool) => tools.set(tool.name, tool),
        },
        {
            baseUrl: 'http://runtime.test',
            ...options,
        }
    );

    return tools;
}

function mockFetch(body) {
    return mock(async () => jsonResponse(body));
}

function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
        headers: {
            'content-type': 'application/json',
        },
        status: 200,
    });
}

function readManifestToolNames() {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const manifestPath = path.join(dirname, '..', 'openclaw.plugin.json');
    return JSON.parse(readFileSync(manifestPath, 'utf8')).contracts.tools;
}
