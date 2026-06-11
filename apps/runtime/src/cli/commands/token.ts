import { getRuntimeApiToken } from '../../config';
import type { ParsedArgs } from '../parse';
import { writeJson } from '../ui';

/** Injectable I/O for `tavern token`, so tests supply fixtures without touching the filesystem. */
export interface TokenDeps {
    getToken(): string;
    write(text: string): void;
}

function defaultDeps(): TokenDeps {
    return {
        getToken: getRuntimeApiToken,
        write: (text) => process.stdout.write(text),
    };
}

/**
 * `tavern token [--json]`. Prints the Runtime API token used to authenticate the
 * Tavern app. Plain output is the token itself (one line, script-friendly).
 * `--json` emits `{ "token": "..." }` for symmetry with other read commands.
 *
 * The token is read from `TAVERN_RUNTIME_TOKEN` env or the `token` key in
 * `tavern.json` under the runtime root (created on first call if absent).
 */
export async function runTokenCommand(
    args: ParsedArgs,
    overrides?: Partial<TokenDeps>
): Promise<number> {
    const deps = { ...defaultDeps(), ...overrides };
    const token = deps.getToken();

    if (args.flags['--json']) {
        writeJson({ token }, deps.write);
        return 0;
    }

    deps.write(`${token}\n`);
    return 0;
}
