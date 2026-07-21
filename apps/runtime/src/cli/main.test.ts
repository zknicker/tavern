import { afterEach, describe, expect, test, vi } from 'vitest';
import { dispatch } from './main';

const ANSI = /\[[0-9;]*m/g;

function capture(stream: 'stdout' | 'stderr'): () => string {
    const chunks: string[] = [];
    vi.spyOn(process[stream], 'write').mockImplementation((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
    });
    return () => chunks.join('').replace(ANSI, '');
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('dispatch', () => {
    test('-v prints bare version, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['-v']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read().trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('--version matches -v', async () => {
        const read = capture('stdout');
        await dispatch(['--version']);
        expect(read().trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('version command prints bare version, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['version']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read().trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('serve → kind serve, no exit code', async () => {
        const result = await dispatch(['serve']);
        expect(result).toEqual({ kind: 'serve' });
    });

    test('serve --help → command help, exit 0 (does not start server)', async () => {
        const read = capture('stdout');
        const result = await dispatch(['serve', '--help']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read()).toContain('grotto serve');
    });

    test('unknown command → did-you-mean, exit 2', async () => {
        const read = capture('stderr');
        const result = await dispatch(['updte']);
        expect(result).toEqual({ kind: 'exit', code: 2 });
        const out = read();
        expect(out).toContain("Unknown command 'updte'");
        expect(out).toContain("Did you mean 'update'?");
    });

    test('unknown flag on a command → usage error prints help, exit 2', async () => {
        const read = capture('stderr');
        const result = await dispatch(['update', '--nope']);
        expect(result).toEqual({ kind: 'exit', code: 2 });
        const out = read();
        expect(out).toContain('grotto update'); // command help printed
        expect(out).toContain("Unknown flag '--nope'");
    });

    test('bare group engine → group help, exit 1', async () => {
        const read = capture('stdout');
        const result = await dispatch(['engine']);
        expect(result).toEqual({ kind: 'exit', code: 1 });
        expect(read()).toContain('grotto engine');
    });

    test('group --help → group help, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['wiki', '--help']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read()).toContain('grotto wiki');
    });

    test('subcommand --help → that subcommand help, not group help, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['wiki', 'list', '--help']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        const out = read();
        expect(out).toContain('grotto wiki list');
        expect(out).not.toContain('<status|list|get|search>');
    });

    test('help update → per-command help, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['help', 'update']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read()).toContain('Stage a Runtime upgrade through Homebrew');
    });

    test('bare grotto → banner + status + commands, exit 0, no serve', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unreachable'));
        const read = capture('stdout');
        const result = await dispatch([]);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        const out = read();
        expect(out).toContain('Grotto Runtime');
        expect(out).toContain('Runtime not running');
        expect(out).toContain('serve');
        expect(out).toContain("Run 'grotto help <command>' for details.");
    });

    test('agent identity makes bare help agent-first without a Runtime probe', async () => {
        const previous = process.env.GROTTO_AGENT_ID;
        process.env.GROTTO_AGENT_ID = 'agt_wren';
        const fetcher = vi.spyOn(globalThis, 'fetch');
        const read = capture('stdout');
        try {
            const result = await dispatch([]);
            expect(result).toEqual({ kind: 'exit', code: 0 });
            const out = read();
            expect(out).toContain('Grotto Agent');
            expect(out.indexOf('Messages')).toBeLessThan(out.indexOf('Server'));
            expect(out).toContain('message');
            expect(out).toContain('serve');
            expect(fetcher).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                Reflect.deleteProperty(process.env, 'GROTTO_AGENT_ID');
            } else {
                process.env.GROTTO_AGENT_ID = previous;
            }
        }
    });

    test('message and inbox check fail honestly with the canonical contract', async () => {
        const read = capture('stderr');
        await expect(dispatch(['message', 'check'])).resolves.toEqual({ kind: 'exit', code: 1 });
        await expect(dispatch(['inbox', 'check'])).resolves.toEqual({ kind: 'exit', code: 1 });
        const out = read();
        expect(out.match(/Code: NOT_YET_AVAILABLE/g)).toHaveLength(2);
        expect(out).toContain('Next action: grotto message read --target <t>');
    });

    test('inbox check exposes real subcommand help', async () => {
        const read = capture('stdout');
        await expect(dispatch(['inbox', 'check', '--help'])).resolves.toEqual({
            kind: 'exit',
            code: 0,
        });
        expect(read()).toContain('grotto inbox check');
        expect(read()).toContain('arrives with inbox cursors');
    });
});
