import { describe, expect, test } from 'vitest';
import type { ParsedArgs } from '../parse.ts';
import { type ClaimDeps, runClaimCommand } from './claim.ts';

function args(values: Record<string, string> = {}): ParsedArgs {
    return { flags: {}, values, positionals: [], help: false };
}

function harness(over: Partial<ClaimDeps> = {}) {
    const captured: string[] = [];
    const savedKeys: string[] = [];
    const deps: Partial<ClaimDeps> = {
        claim: () => ({ alreadyOwner: false, ok: true, userId: 'usr_1' }),
        savePublishableKey: (key) => savedKeys.push(key),
        write: (text) => captured.push(text),
        ...over,
    };
    return { captured, deps, savedKeys };
}

describe('runClaimCommand', () => {
    test('claims and persists the publishable key', async () => {
        const { captured, deps, savedKeys } = harness();
        const code = await runClaimCommand(
            args({ '--clerk-key': 'pk_test_abc', '--user': 'user_clerk_1' }),
            deps
        );
        expect(code).toBe(0);
        expect(savedKeys).toEqual(['pk_test_abc']);
        expect(captured.join('')).toContain('Runtime claimed. Owner: usr_1');
    });

    test('is idempotent for the same owner', async () => {
        const { captured, deps } = harness({
            claim: () => ({ alreadyOwner: true, ok: true, userId: 'usr_1' }),
        });
        const code = await runClaimCommand(
            args({ '--clerk-key': 'pk_test_abc', '--user': 'user_clerk_1' }),
            deps
        );
        expect(code).toBe(0);
        expect(captured.join('')).toContain('Already claimed by this account');
    });

    test('refuses a runtime claimed by someone else and saves nothing', async () => {
        const { captured, deps, savedKeys } = harness({
            claim: () => ({ ok: false, reason: 'claimed-by-other' }),
        });
        const code = await runClaimCommand(
            args({ '--clerk-key': 'pk_test_abc', '--user': 'user_clerk_2' }),
            deps
        );
        expect(code).toBe(1);
        expect(savedKeys).toEqual([]);
        expect(captured.join('')).toContain('already claimed by a different user');
    });

    test('requires both flags', async () => {
        const { captured, deps } = harness();
        const code = await runClaimCommand(args({ '--user': 'user_clerk_1' }), deps);
        expect(code).toBe(1);
        expect(captured.join('')).toContain('requires --clerk-key');
    });
});
