import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { ParsedArgs } from '../parse.ts';
import { runTokenCommand, type TokenDeps } from './token.ts';

function args(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return { flags: {}, values: {}, positionals: [], help: false, ...over };
}

function harness(over: Partial<TokenDeps> = {}): { captured: string[]; deps: Partial<TokenDeps> } {
    const captured: string[] = [];
    return {
        captured,
        deps: { write: (text) => captured.push(text), ...over },
    };
}

describe('runTokenCommand', () => {
    test('prints the token from getToken, exit 0', async () => {
        const { captured, deps } = harness({ getToken: () => 'test-token-abc' });
        const code = await runTokenCommand(args(), deps);
        expect(code).toBe(0);
        expect(captured.join('')).toBe('test-token-abc\n');
    });

    test('--json emits { token } document, exit 0', async () => {
        const { captured, deps } = harness({ getToken: () => 'test-token-xyz' });
        const code = await runTokenCommand(args({ flags: { '--json': true } }), deps);
        expect(code).toBe(0);
        const doc = JSON.parse(captured.join(''));
        expect(doc).toEqual({ token: 'test-token-xyz' });
    });

    test('--json output is valid JSON with no ANSI sequences', async () => {
        const ANSI = /\[/;
        const { captured, deps } = harness({ getToken: () => 'test-token-abc' });
        await runTokenCommand(args({ flags: { '--json': true } }), deps);
        const text = captured.join('');
        expect(ANSI.test(text)).toBe(false);
        expect(() => JSON.parse(text)).not.toThrow();
    });

    test('prints the same token on two successive calls when backed by a file (persistence)', async () => {
        // Simulate the file-backed persistence contract that getRuntimeApiToken provides:
        // a token written to a temp file is read back identically on subsequent calls.
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-token-test-'));
        try {
            const tokenFile = path.join(tmpDir, 'runtime-api-token');
            const persistedToken = 'persisted-token-stable-value';
            fs.writeFileSync(tokenFile, `${persistedToken}\n`, { mode: 0o600 });

            // Stub getToken to simulate the file-backed resolver returning the same value twice.
            const fileToken = fs.readFileSync(tokenFile, 'utf8').trim();
            const getToken = () => fileToken;

            const { captured: c1, deps: d1 } = harness({ getToken });
            await runTokenCommand(args(), d1);
            const token1 = c1.join('').trim();

            const { captured: c2, deps: d2 } = harness({ getToken });
            await runTokenCommand(args(), d2);
            const token2 = c2.join('').trim();

            expect(token1).toBe(persistedToken);
            expect(token1).toBe(token2);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
