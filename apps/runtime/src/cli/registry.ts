import runtimePackage from '../../package.json';
import type { ParsedArgs } from './parse';

/** A single flag a command accepts. */
export interface CliFlag {
    description: string;
    /** Flag token, e.g. `--json`. */
    name: string;
    /** Present when the flag takes a value, e.g. `<topic>`. */
    valueName?: string;
}

export type CliSection = 'Server' | 'Status' | 'Maintenance' | 'Cortex' | 'Engine';

/** Section render order in global help. */
export const SECTION_ORDER: CliSection[] = ['Server', 'Status', 'Maintenance', 'Cortex', 'Engine'];

/** A registered top-level command or command group. */
export interface CliCommand {
    examples: string[];
    flags: CliFlag[];
    /**
     * True for command groups (cortex, engine) whose run() prints group help and
     * exits 1 when invoked bare. The parse layer skips strict flag validation for
     * groups so subcommands handle their own args.
     */
    group?: boolean;
    /** Invocation name, e.g. `update`, `engine`. */
    name: string;
    /** Execute the command. Returns the process exit code. */
    run(args: ParsedArgs, raw: string[]): Promise<number>;
    section: CliSection;
    summary: string;
    /** Usage line shown in per-command help, e.g. `tavern update [--restart]`. */
    usage: string;
}

const version = runtimePackage.version;

const serveCommand: CliCommand = {
    name: 'serve',
    section: 'Server',
    summary: 'Run the foreground Tavern Runtime server',
    usage: 'tavern serve',
    flags: [],
    examples: ['tavern serve'],
    run() {
        // serve is dispatched specially in main.ts (signal handlers + startup).
        return Promise.resolve(0);
    },
};

const statusCommand: CliCommand = {
    name: 'status',
    section: 'Status',
    summary: 'Service, version, capability, and engine health',
    usage: 'tavern status [--json] [--runtime-url <url>]',
    flags: [
        { name: '--json', description: 'Emit one JSON document' },
        {
            name: '--runtime-url',
            valueName: '<url>',
            description: 'Probe a specific Runtime URL (staged-binary hint is local-only)',
        },
    ],
    examples: ['tavern status', 'tavern status --json'],
    async run(args) {
        const { runStatusCommand } = await import('./commands/status');
        return await runStatusCommand(args);
    },
};

const versionCommand: CliCommand = {
    name: 'version',
    section: 'Status',
    summary: 'Print the Runtime version',
    usage: 'tavern version',
    flags: [],
    examples: ['tavern version'],
    run() {
        process.stdout.write(`${version}\n`);
        return Promise.resolve(0);
    },
};

const updateCommand: CliCommand = {
    name: 'update',
    section: 'Maintenance',
    summary: 'Stage a Runtime upgrade through Homebrew',
    usage: 'tavern update [--restart] [--verbose]',
    flags: [
        { name: '--restart', description: 'Restart the service after staging the upgrade' },
        { name: '--verbose', description: 'Print captured Homebrew output' },
    ],
    examples: ['tavern update', 'tavern update --restart'],
    async run(args) {
        const { runUpdateCommand } = await import('./maintenance-commands');
        return await runUpdateCommand({
            restart: Boolean(args.flags['--restart']),
            verbose: Boolean(args.flags['--verbose']),
        });
    },
};

const restartCommand: CliCommand = {
    name: 'restart',
    section: 'Maintenance',
    summary: 'Restart the service and wait for health',
    usage: 'tavern restart [--no-wait]',
    flags: [{ name: '--no-wait', description: 'Skip the post-restart health wait' }],
    examples: ['tavern restart', 'tavern restart --no-wait'],
    async run(args) {
        const { runRestartCommand } = await import('./maintenance-commands');
        return await runRestartCommand({ noWait: Boolean(args.flags['--no-wait']) });
    },
};

const cortexCommand: CliCommand = {
    name: 'cortex',
    section: 'Cortex',
    group: true,
    summary: 'Browse the Cortex knowledge base (status, topics, list, get, search)',
    usage: 'tavern cortex <status|topics|list|get|search> [flags]',
    flags: [
        { name: '--json', description: 'Emit one JSON document' },
        { name: '--topic', valueName: '<topic>', description: 'Limit to a topic' },
        { name: '--include-archived', description: 'Include archived topics and pages' },
        { name: '--runtime-url', valueName: '<url>', description: 'Override the Runtime API URL' },
    ],
    examples: [
        'tavern cortex status',
        'tavern cortex list --topic runtime',
        'tavern cortex get runtime overview',
    ],
    async run(_args, raw) {
        if (raw.length === 0) {
            const { printGroupHelp } = await import('./help');
            printGroupHelp(cortexCommand, process.stdout);
            return 1;
        }
        const [{ CORTEX_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/cortex'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('cortex', CORTEX_SUBCOMMANDS, raw);
    },
};

const engineCommand: CliCommand = {
    name: 'engine',
    section: 'Engine',
    group: true,
    summary: 'Inspect, install, or clean the managed agent engine',
    usage: 'tavern engine <status|install|clean> [flags]',
    flags: [
        { name: '--json', description: 'Emit one JSON document (status)' },
        { name: '--all', description: 'Remove every installed pin (clean)' },
    ],
    examples: ['tavern engine status', 'tavern engine install', 'tavern engine clean --all'],
    async run(_args, raw) {
        if (raw.length === 0) {
            const { printGroupHelp } = await import('./help');
            printGroupHelp(engineCommand, process.stdout);
            return 1;
        }
        const [{ ENGINE_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/engine'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('engine', ENGINE_SUBCOMMANDS, raw);
    },
};

const helpCommand: CliCommand = {
    name: 'help',
    section: 'Status',
    summary: 'Show help for a command or the full command list',
    usage: 'tavern help [command]',
    flags: [],
    examples: ['tavern help', 'tavern help update'],
    async run(args) {
        const { runHelpCommand } = await import('./help');
        return await runHelpCommand(args.positionals[0]);
    },
};

/** Every registered command, in registration order. */
export const COMMANDS: CliCommand[] = [
    serveCommand,
    statusCommand,
    versionCommand,
    updateCommand,
    restartCommand,
    cortexCommand,
    engineCommand,
    helpCommand,
];

/** Commands shown in the global command list (help excluded — it's implicit). */
export const LISTED_COMMANDS: CliCommand[] = COMMANDS.filter((command) => command.name !== 'help');

export function findCommand(name: string): CliCommand | undefined {
    return COMMANDS.find((command) => command.name === name);
}
