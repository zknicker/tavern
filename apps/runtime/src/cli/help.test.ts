import { afterEach, describe, expect, test, vi } from 'vitest';
import { printCommandHelp, printGlobalHelp, printGroupHelp, runHelpCommand } from './help';
import { findCommand } from './registry';

const ANSI = /\[[0-9;]*m/g;

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

describe('global help', () => {
    test('agent shells hide named operator help too', async () => {
        vi.stubEnv('GROTTO_AGENT_ID', 'agt_otto');
        const readErr = capture('stderr');
        expect(await runHelpCommand('token')).toBe(2);
        expect(readErr()).toContain("Unknown command 'token'");
        vi.unstubAllEnvs();
    });

    test('agent shells list only the agent surface', () => {
        vi.stubEnv('GROTTO_AGENT_ID', 'agt_otto');
        const read = capture('stdout');
        printGlobalHelp(process.stdout);
        const out = read();
        vi.unstubAllEnvs();

        expect(out).toContain('Grotto Agent v');
        for (const section of ['Messages', 'Inbox', 'Directory']) {
            expect(out).toContain(section);
        }
        for (const hidden of ['Maintenance', 'Engine', '  update', '  restart']) {
            expect(out).not.toContain(hidden);
        }
    });

    test('lists sections in order with usage and environment', () => {
        const read = capture('stdout');
        printGlobalHelp(process.stdout);
        const out = read();

        expect(out).toContain('Grotto Runtime v');
        const sectionOrder = [
            'Usage',
            'Server',
            'Status',
            'Maintenance',
            'Engine',
            'Environment',
        ];
        let last = -1;
        for (const section of sectionOrder) {
            const at = out.indexOf(section);
            expect(at, section).toBeGreaterThan(last);
            last = at;
        }
        expect(out).toContain('TAVERN_RUNTIME_PORT');
        expect(out).not.toContain('help'); // help command excluded from listing
    });
});

describe('per-command help', () => {
    test('update shows summary, usage, flags, examples', () => {
        const read = capture('stdout');
        printCommandHelp(findCommand('update')!, process.stdout);
        const out = read();

        expect(out).toContain('Stage a Runtime upgrade through Homebrew');
        expect(out).toContain('grotto update [--restart] [--verbose]');
        expect(out).toContain('--restart');
        expect(out).toContain('--verbose');
        expect(out).toContain('Examples');
    });

    test('group help shows subcommand usage and examples', () => {
        const read = capture('stdout');
        printGroupHelp(findCommand('engine')!, process.stdout);
        const out = read();
        expect(out).toContain('grotto engine <status|install|clean> [flags]');
        expect(out).toContain('grotto engine install');
    });
});

describe('runHelpCommand', () => {
    test('bare → global help, exit 0', async () => {
        const read = capture('stdout');
        const code = await runHelpCommand();
        expect(code).toBe(0);
        expect(read()).toContain('Usage');
    });

    test('named command → that command help, exit 0', async () => {
        const read = capture('stdout');
        const code = await runHelpCommand('restart');
        expect(code).toBe(0);
        expect(read()).toContain('Restart the service and wait for health');
    });

    test('unknown name → did-you-mean on stderr, exit 2', async () => {
        const read = capture('stderr');
        const code = await runHelpCommand('updte');
        expect(code).toBe(2);
        const out = read();
        expect(out).toContain("Unknown command 'updte'");
        expect(out).toContain("Did you mean 'update'?");
    });
});
