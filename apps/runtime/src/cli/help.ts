import runtimePackage from '../../package.json';
import { suggest } from './parse';
import { type CliCommand, findCommand, LISTED_COMMANDS, SECTION_ORDER } from './registry';
import { errorBlock, heading, rows, ui } from './ui';

/**
 * `tavern help [command]` entry. Bare → global help. Named → per-command help, or
 * a did-you-mean error (exit 2) for an unknown command.
 */
export async function runHelpCommand(name?: string): Promise<number> {
    if (!name) {
        printGlobalHelp(process.stdout);
        return 0;
    }
    const command = findCommand(name);
    if (!command) {
        const hint = suggest(
            name,
            LISTED_COMMANDS.map((entry) => entry.name)
        );
        process.stderr.write(
            `${errorBlock(
                `Unknown command '${name}'.`,
                hint ? `Did you mean '${hint}'?` : "Run 'tavern help' for the command list."
            )}\n`
        );
        return 2;
    }
    if (command.group) {
        printGroupHelp(command, process.stdout);
    } else {
        printCommandHelp(command, process.stdout);
    }
    return 0;
}

const ENVIRONMENT: { name: string; description: string }[] = [
    { name: 'TAVERN_RUNTIME_URL', description: 'Runtime API URL for client commands' },
    { name: 'TAVERN_RUNTIME_HOST', description: 'Bind host (default 127.0.0.1)' },
    { name: 'TAVERN_RUNTIME_PORT', description: 'Bind port (default 18790)' },
    {
        name: 'TAVERN_RUNTIME_ROOT',
        description:
            'Runtime data root (default ~/.tavern/runtime; Homebrew package uses <prefix>/var/tavern/runtime)',
    },
];

/** Full command list grouped by section, plus usage and environment. */
export function printGlobalHelp(stream: NodeJS.WriteStream): void {
    const blocks: string[] = [
        `${ui.bold(`Tavern Runtime v${runtimePackage.version}`, stream)}`,
        `${heading('Usage', stream)}\n  tavern <command> [flags]`,
    ];

    for (const section of SECTION_ORDER) {
        const entries = LISTED_COMMANDS.filter((command) => command.section === section);
        if (entries.length === 0) {
            continue;
        }
        const body = rows(
            entries.map((command) => ({ left: command.name, right: command.summary })),
            '  '
        );
        blocks.push(`${heading(section, stream)}\n${body}`);
    }

    const env = rows(
        ENVIRONMENT.map((entry) => ({ left: entry.name, right: entry.description })),
        '  '
    );
    blocks.push(`${heading('Environment', stream)}\n${env}`);

    stream.write(`${blocks.join('\n\n')}\n`);
}

/** Group help: summary, usage, subcommand flags, examples. Used on bare groups. */
export function printGroupHelp(command: CliCommand, stream: NodeJS.WriteStream): void {
    printCommandHelp(command, stream);
}

/** Per-command help: summary, usage, flags with descriptions, examples. */
export function printCommandHelp(command: CliCommand, stream: NodeJS.WriteStream): void {
    const blocks: string[] = [command.summary, `${heading('Usage', stream)}\n  ${command.usage}`];

    if (command.flags.length > 0) {
        const body = rows(
            command.flags.map((flag) => ({
                left: flag.valueName ? `${flag.name} ${flag.valueName}` : flag.name,
                right: flag.description,
            })),
            '  '
        );
        blocks.push(`${heading('Flags', stream)}\n${body}`);
    }

    if (command.examples.length > 0) {
        const body = command.examples.map((example) => `  ${example}`).join('\n');
        blocks.push(`${heading('Examples', stream)}\n${body}`);
    }

    stream.write(`${blocks.join('\n\n')}\n`);
}
