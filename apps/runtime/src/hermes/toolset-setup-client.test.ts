import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HermesHttp } from './http';
import { ToolsetSetupClient } from './toolset-setup-client';

// Engine-shaped fixtures pinned to /api/tools/toolsets/{name}/* responses.
const configFixture = {
    active_provider: 'brave',
    has_category: true,
    name: 'web',
    providers: [
        {
            badge: 'recommended',
            env_vars: [
                {
                    default: null,
                    is_set: false,
                    key: 'BRAVE_API_KEY',
                    prompt: 'Brave Search API key',
                    url: 'https://brave.com/search/api/',
                },
            ],
            is_active: true,
            name: 'brave',
            post_setup: null,
            requires_nous_auth: false,
            tag: 'search',
        },
        {
            badge: '',
            env_vars: [],
            is_active: false,
            name: 'ddgs',
            post_setup: 'ddgs-install',
            requires_nous_auth: false,
            tag: '',
        },
    ],
};

describe('ToolsetSetupClient', () => {
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
        return new ToolsetSetupClient(
            new HermesHttp({ baseUrl: `http://127.0.0.1:${port}`, token: null }),
            { pollIntervalMs: 5, timeoutMs: 2000 }
        );
    }

    it('maps the provider matrix with env var status', async () => {
        const client = await startFixture(() => configFixture);
        const config = await client.getConfig('web');

        expect(config.activeProvider).toBe('brave');
        expect(config.providers[0]?.envVars[0]).toEqual({
            defaultValue: null,
            isSet: false,
            key: 'BRAVE_API_KEY',
            prompt: 'Brave Search API key',
            url: 'https://brave.com/search/api/',
        });
        expect(config.providers[1]?.postSetup).toBe('ddgs-install');
    });

    it('maps the env save result with refreshed key status', async () => {
        const client = await startFixture(() => ({
            is_set: { BRAVE_API_KEY: true },
            name: 'web',
            ok: true,
            saved: ['BRAVE_API_KEY'],
            skipped: [],
        }));
        const result = await client.saveEnv('web', { env: { BRAVE_API_KEY: 'secret' } });

        expect(result).toEqual({
            isSet: { BRAVE_API_KEY: true },
            name: 'web',
            ok: true,
            saved: ['BRAVE_API_KEY'],
            skipped: [],
        });
    });

    it('waits for the post-setup action to exit', async () => {
        let polls = 0;
        const client = await startFixture((pathname) => {
            if (pathname.endsWith('/post-setup')) {
                return { name: 'tools-post-setup', ok: true, pid: 9 };
            }
            polls += 1;
            return polls < 2
                ? { exit_code: null, lines: [], running: true }
                : { exit_code: 0, lines: ['installed'], running: false };
        });
        const result = await client.runPostSetup('web', 'ddgs-install');

        expect(result).toEqual({ exitCode: 0, log: ['installed'], ok: true });
    });
});
