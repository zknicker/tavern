import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HermesHttp } from './http';
import { McpClient } from './mcp-client';

// Engine-shaped fixtures pinned to /api/mcp/* responses.
const serversFixture = {
    servers: [
        {
            args: [],
            auth: null,
            command: null,
            enabled: true,
            env: {},
            name: 'linear',
            tools: null,
            transport: 'http',
            url: 'https://mcp.linear.app/sse',
        },
        {
            args: ['-y', 'firecrawl-mcp'],
            auth: null,
            command: 'npx',
            enabled: false,
            env: { FIRECRAWL_API_KEY: '***' },
            name: 'firecrawl',
            tools: null,
            transport: 'stdio',
            url: null,
        },
    ],
};

const catalogFixture = {
    diagnostics: [],
    entries: [
        {
            auth_type: 'env',
            description: 'Web scraping for agents',
            enabled: false,
            installed: false,
            name: 'firecrawl',
            needs_install: false,
            required_env: [
                { name: 'FIRECRAWL_API_KEY', prompt: 'Firecrawl API key', required: true },
            ],
            source: 'optional-mcps',
            transport: 'stdio',
        },
    ],
};

describe('McpClient', () => {
    let server: Server | null = null;

    afterEach(() => {
        server?.close();
        server = null;
    });

    async function startFixture(handler: (pathname: string, method: string) => unknown) {
        server = createServer((request, response) => {
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify(handler(pathname, request.method ?? 'GET')));
        });
        await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
        const address = server?.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        return new McpClient(new HermesHttp({ baseUrl: `http://127.0.0.1:${port}`, token: null }), {
            pollIntervalMs: 5,
            timeoutMs: 2000,
        });
    }

    it('maps MCP servers with transport and enablement', async () => {
        const client = await startFixture(() => serversFixture);
        const result = await client.listServers();

        expect(result.servers).toEqual([
            {
                args: [],
                command: null,
                enabled: true,
                name: 'linear',
                transport: 'http',
                url: 'https://mcp.linear.app/sse',
            },
            {
                args: ['-y', 'firecrawl-mcp'],
                command: 'npx',
                enabled: false,
                name: 'firecrawl',
                transport: 'stdio',
                url: null,
            },
        ]);
    });

    it('maps catalog entries with required env metadata', async () => {
        const client = await startFixture(() => catalogFixture);
        const catalog = await client.getCatalog();

        expect(catalog.entries[0]).toEqual({
            authType: 'env',
            description: 'Web scraping for agents',
            enabled: false,
            installed: false,
            name: 'firecrawl',
            needsInstall: false,
            requiredEnv: [
                { name: 'FIRECRAWL_API_KEY', prompt: 'Firecrawl API key', required: true },
            ],
            source: 'optional-mcps',
            transport: 'stdio',
        });
    });

    it('returns a synchronous result for catalog entries without a git bootstrap', async () => {
        const client = await startFixture(() => ({
            background: false,
            name: 'firecrawl',
            ok: true,
        }));
        const result = await client.installCatalogEntry({ enable: true, name: 'firecrawl' });

        expect(result).toEqual({ exitCode: 0, log: [], ok: true });
    });

    it('waits for the background install action for git-bootstrap entries', async () => {
        let polls = 0;
        const client = await startFixture((pathname) => {
            if (pathname === '/api/mcp/catalog/install') {
                return { action: 'mcp-install', background: true, name: 'big', ok: true };
            }
            polls += 1;
            return polls < 2
                ? { exit_code: null, lines: [], running: true }
                : { exit_code: 0, lines: ['cloned'], running: false };
        });
        const result = await client.installCatalogEntry({ enable: true, name: 'big' });

        expect(result).toEqual({ exitCode: 0, log: ['cloned'], ok: true });
    });

    it('maps a failed server test', async () => {
        const client = await startFixture(() => ({
            error: 'connection refused',
            ok: false,
            tools: [],
        }));
        const result = await client.testServer('linear');

        expect(result).toEqual({ error: 'connection refused', ok: false, tools: [] });
    });
});
