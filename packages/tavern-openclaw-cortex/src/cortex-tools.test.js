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
