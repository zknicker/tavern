import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ParsedArgs } from './parse';
import { dispatchSubcommand, type SubCommand } from './subcommand';

function sub(over: Partial<SubCommand> = {}): SubCommand {
    return {
        name: 'get',
        summary: 'Get a thing',
        usage: 'grotto wiki get <path>',
        flags: [{ name: '--json', description: 'Emit JSON' }],
        positionals: ['<path>'],
        examples: ['grotto wiki get Projects/Alpha.md'],
        run: () => Promise.resolve(0),
        ...over,
    };
}

afterEach(() => vi.restoreAllMocks());

function stderr() {
    return vi.spyOn(process.stderr, 'write').mockReturnValue(true);
}
function stdout() {
    return vi.spyOn(process.stdout, 'write').mockReturnValue(true);
}

describe('dispatchSubcommand', () => {
    test('routes to the matching subcommand with parsed args', async () => {
        let received: ParsedArgs | null = null;
        const code = await dispatchSubcommand(
            'wiki',
            [
                sub({
                    run: (a) => {
                        received = a;
                        return Promise.resolve(0);
                    },
                }),
            ],
            ['get', 'Projects/Alpha.md']
        );
        expect(code).toBe(0);
        expect(received).not.toBeNull();
        expect((received as unknown as ParsedArgs).positionals).toEqual(['Projects/Alpha.md']);
    });

    test('unknown subcommand suggests a near match, exit 2', async () => {
        const out = stderr();
        const code = await dispatchSubcommand('wiki', [sub({ name: 'status' })], ['statuss']);
        expect(code).toBe(2);
        expect(out.mock.calls.join('')).toContain("Did you mean 'wiki status'?");
    });

    test('wrong positional arity prints help to stderr, exit 2', async () => {
        const out = stderr();
        const code = await dispatchSubcommand('wiki', [sub()], ['get']);
        expect(code).toBe(2);
        const written = out.mock.calls.join('');
        expect(written).toContain('Expected 1 argument');
        expect(written).toContain('grotto wiki get <path>');
    });

    test('unknown flag prints help to stderr, exit 2', async () => {
        const out = stderr();
        const code = await dispatchSubcommand(
            'wiki',
            [sub({ name: 'status', positionals: [] })],
            ['status', '--nope']
        );
        expect(code).toBe(2);
        expect(out.mock.calls.join('')).toContain("Unknown flag '--nope'");
    });

    test('--help prints to stdout, exit 0, run not invoked', async () => {
        const out = stdout();
        let ran = false;
        const code = await dispatchSubcommand(
            'wiki',
            [
                sub({
                    run: () => {
                        ran = true;
                        return Promise.resolve(0);
                    },
                }),
            ],
            ['get', '--help']
        );
        expect(code).toBe(0);
        expect(ran).toBe(false);
        expect(out.mock.calls.join('')).toContain('grotto wiki get <path>');
    });
});
