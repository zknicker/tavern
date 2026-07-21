import path from 'node:path';
import { DATA_DIR, saveClerkPublishableKey } from '../../config';
import { initDb } from '../../db/connection';
import { ensureRuntimeSchema } from '../../db/schema';
import { type ClaimOutcome, claimRuntimeForClerkUser } from '../../identity/claim';
import type { ParsedArgs } from '../parse';

/** Injectable I/O for `grotto claim`, so tests supply fixtures. */
export interface ClaimDeps {
    claim(input: { clerkUserId: string; publishableKey: string }): ClaimOutcome;
    savePublishableKey(key: string): void;
    write(text: string): void;
}

function defaultDeps(): ClaimDeps {
    return {
        claim(input) {
            const db = initDb(path.join(DATA_DIR, 'runtime.db'));
            ensureRuntimeSchema(db);
            return claimRuntimeForClerkUser(input, db);
        },
        savePublishableKey: saveClerkPublishableKey,
        write: (text) => process.stdout.write(text),
    };
}

/**
 * `grotto claim --clerk-key <key> --user <clerk-user-id>`. Run on the runtime
 * host: configures Clerk verification and records the runtime owner. The
 * Grotto app generates this command on its connect-runtime page.
 */
export async function runClaimCommand(
    args: ParsedArgs,
    overrides?: Partial<ClaimDeps>
): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const publishableKey = args.values['--clerk-key']?.trim();
    const clerkUserId = args.values['--user']?.trim();
    if (!(publishableKey && clerkUserId)) {
        deps.write('grotto claim requires --clerk-key <key> and --user <clerk-user-id>.\n');
        return 1;
    }

    const outcome = deps.claim({ clerkUserId, publishableKey });
    if (!outcome.ok) {
        if (outcome.reason === 'invalid-key') {
            deps.write('The provided Clerk publishable key is not valid.\n');
            return 1;
        }
        deps.write(
            'This runtime is already claimed by a different user. To reset ownership, delete the runtime database and claim again.\n'
        );
        return 1;
    }

    deps.savePublishableKey(publishableKey);
    deps.write(
        outcome.alreadyOwner
            ? `Already claimed by this account (${outcome.userId}). Sign-in settings refreshed.\n`
            : `Runtime claimed. Owner: ${outcome.userId}. Sign in to the Grotto app to connect.\n`
    );
    return 0;
}
