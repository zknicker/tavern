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

    test('operator commands are unavailable in agent shells', async () => {
        vi.stubEnv('GROTTO_AGENT_ID', 'agt_otto');
        vi.stubEnv('GROTTO_SERVER_URL', 'http://127.0.0.1:1');
        vi.stubEnv('GROTTO_AGENT_TOKEN_FILE', '/nonexistent/token');
        const read = capture('stderr');
        for (const name of ['token', 'serve', 'update', 'restart', 'status', 'claim']) {
            expect(await dispatch([name])).toEqual({ kind: 'exit', code: 1 });
        }
        const out = read();
        expect(out).toContain('Code: OPERATOR_COMMAND_UNAVAILABLE');
        expect(out).toContain("'grotto token' is an operator command");
        vi.unstubAllEnvs();
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
        const result = await dispatch(['engine', '--help']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        expect(read()).toContain('grotto engine');
    });

    test('subcommand --help → that subcommand help, not group help, exit 0', async () => {
        const read = capture('stdout');
        const result = await dispatch(['engine', 'status', '--help']);
        expect(result).toEqual({ kind: 'exit', code: 0 });
        const out = read();
        expect(out).toContain('grotto engine status');
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

    test('agent identity makes bare help agent-only without a Runtime probe', async () => {
        const previous = process.env.GROTTO_AGENT_ID;
        process.env.GROTTO_AGENT_ID = 'agt_wren';
        const fetcher = vi.spyOn(globalThis, 'fetch');
        const read = capture('stdout');
        try {
            const result = await dispatch([]);
            expect(result).toEqual({ kind: 'exit', code: 0 });
            const out = read();
            expect(out).toContain('Grotto Agent');
            expect(out).toContain('Messages');
            expect(out).toContain('message');
            expect(out).not.toContain('Maintenance');
            expect(out).not.toContain('Run the foreground');
            expect(fetcher).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                Reflect.deleteProperty(process.env, 'GROTTO_AGENT_ID');
            } else {
                process.env.GROTTO_AGENT_ID = previous;
            }
        }
    });

    test('message react fails honestly with the canonical contract', async () => {
        const read = capture('stderr');
        await expect(dispatch(['message', 'react'])).resolves.toEqual({ kind: 'exit', code: 1 });
        const out = read();
        expect(out).toContain('Code: NOT_YET_AVAILABLE');
        expect(out).toContain('Next action: grotto message send --target <t>');
    });

    test('inbox check exposes real subcommand help', async () => {
        const read = capture('stdout');
        await expect(dispatch(['inbox', 'check', '--help'])).resolves.toEqual({
            kind: 'exit',
            code: 0,
        });
        expect(read()).toContain('grotto inbox check');
        expect(read()).toContain('List pending targets without draining them');
    });
});
