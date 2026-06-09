import { describe, expect, test, vi } from 'vitest';
import { parseCli, printHelp, runCortexCli } from './cli';

describe('Tavern Runtime CLI', () => {
    test('prints llm-wiki Cortex commands', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        printHelp();

        const help = String(logSpy.mock.calls[0]?.[0] ?? '');
        expect(help).toContain('tavern cortex topics');
        expect(help).toContain('tavern cortex get <topic> <path>');
        expect(help).toContain('TAVERN_WIKI_HUB_PATH');
        expect(help).toContain('tavern engine status');
        expect(help).toContain('tavern engine install');
        expect(help).not.toContain('tavern cortex embed');
    });

    test('routes engine commands through the serve dispatcher', () => {
        expect(parseCli(['engine', 'status', '--json'])).toEqual({
            command: 'serve',
            rest: ['engine', 'status', '--json'],
        });
        expect(parseCli(['engine', 'install'])).toEqual({
            command: 'serve',
            rest: ['engine', 'install'],
        });
    });

    test('rejects unknown top-level commands', () => {
        expect(() => parseCli(['enginee'])).toThrow(/Unknown command/);
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
