import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeAgent } from '@tavern/api';
import { browserPluginId } from '@tavern/api/plugins/browser';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { writePluginConfig } from '../plugins/store.ts';
import { createWebToolsForAgent } from './agent-tools.ts';
import { fetchPageAsMarkdown } from './fetch-page.ts';

const maxBodyBytes = 2 * 1024 * 1024;
const truncationMarker = '[Content truncated at 40000 characters]';

describe('fetchPageAsMarkdown', () => {
    let baseUrl: string;
    let server: Server;

    beforeAll(async () => {
        server = createServer((request, response) => {
            switch (request.url) {
                case '/article':
                    response.setHeader('content-type', 'text/html; charset=utf-8');
                    response.end(`<!doctype html><html><head><title>Readable Story</title></head>
                        <body><article><h1>Readable Story</h1><p>${'Useful article text. '.repeat(40)}</p></article></body></html>`);
                    return;
                case '/redirect':
                    response.writeHead(302, { location: '/article' });
                    response.end();
                    return;
                case '/missing':
                    response.writeHead(503, { 'content-type': 'text/plain' });
                    response.end('Unavailable');
                    return;
                case '/image':
                    response.setHeader('content-type', 'image/png');
                    response.end('not really an image');
                    return;
                case '/oversized':
                    response.setHeader('content-type', 'text/plain');
                    response.end('x'.repeat(maxBodyBytes + 1024));
                    return;
                case '/markdown-cap':
                    response.setHeader('content-type', 'text/markdown');
                    response.end(`# Large\n\n${'a'.repeat(50_000)}`);
                    return;
                default:
                    response.writeHead(404, { 'content-type': 'text/plain' });
                    response.end('Not found');
            }
        });
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        if (!server.listening) {
            return;
        }
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    });

    test('converts readable HTML to markdown with its title', async () => {
        const page = await fetchPageAsMarkdown(`${baseUrl}/article`);

        expect(page).toMatchObject({
            finalUrl: `${baseUrl}/article`,
            title: 'Readable Story',
            truncated: false,
        });
        expect(page.markdown).toContain('Useful article text.');
    });

    test('reports the final URL after redirects', async () => {
        const page = await fetchPageAsMarkdown(`${baseUrl}/redirect`);

        expect(page.finalUrl).toBe(`${baseUrl}/article`);
    });

    test('stops oversized response bodies and marks them truncated', async () => {
        const page = await fetchPageAsMarkdown(`${baseUrl}/oversized`);

        expect(page.truncated).toBe(true);
        expect(page.markdown.length).toBe(40_000);
    });

    test('caps markdown and appends the truncation marker', async () => {
        const page = await fetchPageAsMarkdown(`${baseUrl}/markdown-cap`);

        expect(page.truncated).toBe(true);
        expect(page.markdown).toHaveLength(40_000);
        expect(page.markdown.endsWith(truncationMarker)).toBe(true);
    });

    test('returns fetch failures as tool errors', async () => {
        const tools = createWebToolsForAgent(createAgent(true));

        await expect(runTool(tools, { url: `${baseUrl}/missing` })).resolves.toEqual({
            error: 'Web request failed with status 503.',
        });
        await expect(runTool(tools, { url: `${baseUrl}/image` })).resolves.toEqual({
            error: 'Unsupported content type: image/png.',
        });
    });
});

describe('createWebToolsForAgent', () => {
    test('gates web_fetch on explicit agent web access', () => {
        expect(createWebToolsForAgent(createAgent(false))).toEqual({});
        expect(createWebToolsForAgent(createAgent())).toEqual({});
        expect(createWebToolsForAgent(createAgent(true))).toHaveProperty('web_fetch');
    });

    test('labels fetched content as untrusted external data', () => {
        const tool = createWebToolsForAgent(createAgent(true)).web_fetch;

        expect(tool?.description).toContain('UNTRUSTED external data');
    });


    test('returns non-http scheme failures as tool errors', async () => {
        const tools = createWebToolsForAgent(createAgent(true));

        await expect(runTool(tools, { url: 'file:///tmp/page.html' })).resolves.toEqual({
            error: 'Only http(s) URLs can be fetched.',
        });
    });
});

function createAgent(webAccessEnabled?: boolean): AgentRuntimeAgent {
    return {
        ...(webAccessEnabled === undefined ? {} : { webAccessEnabled }),
        enabledSkillIds: [],
        id: 'agt_web_test',
        isAdmin: true,
        name: 'Web Test',
        primaryColor: null,
        workspaceFolder: '/tmp/tavern-web-test',
    };
}

async function runTool(tools: ToolSet, input: { url: string }) {
    const selected = tools.web_fetch as unknown as {
        execute: (input: { url: string }, options: { messages: []; toolCallId: string }) => unknown;
    };
    return await selected.execute(input, {
        messages: [],
        toolCallId: 'call_web_fetch',
    });
}
