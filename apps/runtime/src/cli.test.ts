import { describe, expect, test, vi } from 'vitest';
import { printHelp, runCortexCli } from './cli';

describe('Tavern Runtime CLI', () => {
    test('prints llm-wiki Cortex commands', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        printHelp();

        const help = String(logSpy.mock.calls[0]?.[0] ?? '');
        expect(help).toContain('tavern cortex topics');
        expect(help).toContain('tavern cortex get <topic> <path>');
        expect(help).toContain('TAVERN_WIKI_HUB_PATH');
        expect(help).not.toContain('tavern cortex embed');
    });

    test('prints Cortex status from Runtime', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            jsonResponse({
                archivedTopicCount: 1,
                configSource: 'runtime',
                hubPath: '/Users/me/wiki',
                pageCount: 8,
                readable: true,
                topicCount: 2,
                writable: true,
            })
        );
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCortexCli(['status', '--runtime-url', 'http://runtime.test']);

        expect(fetchSpy).toHaveBeenCalledWith(
            new URL('/cortex/status', 'http://runtime.test'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(logSpy.mock.calls.map((call) => call[0]).join('\n')).toContain(
            'Hub: /Users/me/wiki'
        );
    });
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status: 200,
        ...init,
    });
}
