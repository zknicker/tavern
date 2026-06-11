import { describe, expect, test, vi } from 'vitest';
import { runCortexCli } from './cli';

describe('Tavern Runtime Cortex CLI', () => {
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
