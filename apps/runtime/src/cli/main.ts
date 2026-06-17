import runtimePackage from '../../package.json';
import { runBareTavern } from './bare';
import { printCommandHelp, printGlobalHelp, printGroupHelp } from './help';
import { parseArgs, suggest, UsageError } from './parse';
import { type CliCommand, findCommand, LISTED_COMMANDS } from './registry';
import { errorBlock } from './ui';

/** Result telling index.ts whether to start the server or exit with a code. */
export type DispatchResult = { kind: 'serve' } | { kind: 'exit'; code: number };

/**
 * Parse argv and dispatch through the registry. Returns `{ kind: 'serve' }` only
 * for `tavern serve`, so index.ts owns server startup and signal handlers. Maps
 * all errors to the 0/1/2 exit-code contract.
 */
export async function dispatch(argv: string[]): Promise<DispatchResult> {
    const [name, ...rest] = argv;

    if (!name) {
        return { kind: 'exit', code: await runBareTavern() };
    }

    if (name === '-v' || name === '--version') {
        process.stdout.write(`${runtimePackage.version}\n`);
        return { kind: 'exit', code: 0 };
    }

    if (name === '-h' || name === '--help') {
        printGlobalHelp(process.stdout);
        return { kind: 'exit', code: 0 };
    }

    const command = findCommand(name);
    if (!command) {
        return { kind: 'exit', code: reportUnknown(name) };
    }

    if (command.name === 'serve') {
        if (wantsHelp(rest)) {
            printCommandHelp(command, process.stdout);
            return { kind: 'exit', code: 0 };
        }
        return { kind: 'serve' };
    }

    return { kind: 'exit', code: await runCommand(command, rest) };
}

async function runCommand(command: CliCommand, rest: string[]): Promise<number> {
    try {
        if (command.group) {
            return await runGroup(command, rest);
        }
        const parsed = parseArgs(command, rest);
        if (parsed.help) {
            printCommandHelp(command, process.stdout);
            return 0;
        }
        return await command.run(parsed, rest);
    } catch (error) {
        return reportError(error, command);
    }
}

/**
 * Groups (vault/engine) print group help only for the bare group or a leading
 * `--help`. Once a subcommand token is present (`vault list --help`), the group
 * defers to subcommand dispatch so the subcommand renders its own help.
 */
async function runGroup(command: CliCommand, rest: string[]): Promise<number> {
    const first = rest[0];
    if (rest.length === 0 || first === '--help' || first === '-h') {
        printGroupHelp(command, process.stdout);
        // Bare group → exit 1 (spec); explicit --help → exit 0.
        return rest.length === 0 ? 1 : 0;
    }
    return await command.run({ flags: {}, values: {}, positionals: [], help: false }, rest);
}

function wantsHelp(rest: string[]): boolean {
    return rest.includes('--help') || rest.includes('-h');
}

function reportUnknown(name: string): number {
    const hint = suggest(
        name,
        LISTED_COMMANDS.map((command) => command.name)
    );
    process.stderr.write(
        `${errorBlock(
            `Unknown command '${name}'.`,
            hint ? `Did you mean '${hint}'?` : "Run 'tavern help' for the command list."
        )}\n`
    );
    return 2;
}

function reportError(error: unknown, command: CliCommand): number {
    if (error instanceof UsageError) {
        printCommandHelp(error.command ?? command, process.stderr);
        process.stderr.write(`\n${errorBlock(error.message)}\n`);
        return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${errorBlock(message)}\n`);
    return 1;
}
