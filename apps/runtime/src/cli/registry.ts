import runtimePackage from '../../package.json';
import {
    attachmentCommand,
    channelCommand,
    inboxCommand,
    messageCommand,
    profileCommand,
    reminderCommand,
    serverInfoCommand,
    skillCommand,
    taskCommand,
    threadCommand,
} from './agent-commands.ts';
import type { ParsedArgs } from './parse';

/** A single flag a command accepts. */
export interface CliFlag {
    description: string;
    /** Flag token, e.g. `--json`. */
    name: string;
    /** Present when the flag takes a value, e.g. `<topic>`. */
    valueName?: string;
}

export type CliSection =
    | 'Messages'
    | 'Inbox'
    | 'Directory'
    | 'Tasks'
    | 'Attachments'
    | 'Profile'
    | 'Reminders'
    | 'Skills'
    | 'Server'
    | 'Status'
    | 'Maintenance'
    | 'Engine';

/** Section render order in global help. */
export const SECTION_ORDER: CliSection[] = ['Server', 'Status', 'Maintenance', 'Engine'];
export const AGENT_SECTION_ORDER: CliSection[] = [
    'Messages',
    'Inbox',
    'Directory',
    'Tasks',
    'Attachments',
    'Profile',
    'Reminders',
    'Skills',
];

/** A registered top-level command or command group. */
export interface CliCommand {
    examples: string[];
    flags: CliFlag[];
    /**
     * True for command groups (memory, engine) whose run() prints group help and
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
    /** Usage line shown in per-command help, e.g. `grotto update [--restart]`. */
    usage: string;
}

const version = runtimePackage.version;

const serveCommand: CliCommand = {
    name: 'serve',
    section: 'Server',
    summary: 'Run the foreground Grotto Runtime server',
    usage: 'grotto serve',
    flags: [],
    examples: ['grotto serve'],
    run() {
        // serve is dispatched specially in main.ts (signal handlers + startup).
        return Promise.resolve(0);
    },
};

const statusCommand: CliCommand = {
    name: 'status',
    section: 'Status',
    summary: 'Service, version, capability, and engine health',
    usage: 'grotto status [--json] [--runtime-url <url>]',
    flags: [
        { name: '--json', description: 'Emit one JSON document' },
        {
            name: '--runtime-url',
            valueName: '<url>',
            description: 'Probe a specific Runtime URL (staged-binary hint is local-only)',
        },
    ],
    examples: ['grotto status', 'grotto status --json'],
    async run(args) {
        const { runStatusCommand } = await import('./commands/status');
        return await runStatusCommand(args);
    },
};

const versionCommand: CliCommand = {
    name: 'version',
    section: 'Status',
    summary: 'Print the Runtime version',
    usage: 'grotto version',
    flags: [],
    examples: ['grotto version'],
    run() {
        process.stdout.write(`${version}\n`);
        return Promise.resolve(0);
    },
};

const updateCommand: CliCommand = {
    name: 'update',
    section: 'Maintenance',
    summary: 'Stage a Runtime upgrade through Homebrew',
    usage: 'grotto update [--restart] [--verbose]',
    flags: [
        { name: '--restart', description: 'Restart the service after staging the upgrade' },
        { name: '--verbose', description: 'Print captured Homebrew output' },
    ],
    examples: ['grotto update', 'grotto update --restart'],
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
    usage: 'grotto restart [--no-wait]',
    flags: [{ name: '--no-wait', description: 'Skip the post-restart health wait' }],
    examples: ['grotto restart', 'grotto restart --no-wait'],
    async run(args) {
        const { runRestartCommand } = await import('./maintenance-commands');
        return await runRestartCommand({ noWait: Boolean(args.flags['--no-wait']) });
    },
};

const engineCommand: CliCommand = {
    name: 'engine',
    section: 'Engine',
    group: true,
    summary: 'Inspect, install, or clean the managed agent engine',
    usage: 'grotto engine <status|install|clean> [flags]',
    flags: [
        { name: '--json', description: 'Emit one JSON document (status)' },
        { name: '--all', description: 'Remove every installed pin (clean)' },
    ],
    examples: ['grotto engine status', 'grotto engine install', 'grotto engine clean --all'],
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

const claimCommand: CliCommand = {
    name: 'claim',
    section: 'Server',
    summary: 'Bind this runtime to a Grotto account (run on the runtime host)',
    usage: 'grotto claim --clerk-key <key> --user <clerk-user-id>',
    flags: [
        {
            name: '--clerk-key',
            description: 'Clerk publishable key used to verify sign-ins',
            valueName: '<key>',
        },
        { name: '--user', description: 'Clerk user id that owns this runtime', valueName: '<id>' },
    ],
    examples: ['grotto claim --clerk-key pk_test_abc --user user_2abc'],
    async run(args) {
        const { runClaimCommand } = await import('./commands/claim');
        return await runClaimCommand(args);
    },
};

const tokenCommand: CliCommand = {
    name: 'token',
    section: 'Status',
    summary: 'Print the Runtime API token for pairing the Grotto app',
    usage: 'grotto token [--json]',
    flags: [{ name: '--json', description: 'Emit one JSON document' }],
    examples: ['grotto token', 'grotto token --json'],
    async run(args) {
        const { runTokenCommand } = await import('./commands/token');
        return await runTokenCommand(args);
    },
};

const helpCommand: CliCommand = {
    name: 'help',
    section: 'Status',
    summary: 'Show help for a command or the full command list',
    usage: 'grotto help [command]',
    flags: [],
    examples: ['grotto help', 'grotto help update'],
    async run(args) {
        const { runHelpCommand } = await import('./help');
        return await runHelpCommand(args.positionals[0]);
    },
};

/** Every registered command, in registration order. */
export const COMMANDS: CliCommand[] = [
    messageCommand,
    inboxCommand,
    serverInfoCommand,
    channelCommand,
    threadCommand,
    taskCommand,
    reminderCommand,
    attachmentCommand,
    profileCommand,
    skillCommand,
    serveCommand,
    claimCommand,
    statusCommand,
    versionCommand,
    tokenCommand,
    updateCommand,
    restartCommand,
    engineCommand,
    helpCommand,
];

/** Commands shown in the global command list (help excluded — it's implicit). */
export const LISTED_COMMANDS: CliCommand[] = COMMANDS.filter((command) => command.name !== 'help');

export function findCommand(name: string): CliCommand | undefined {
    return COMMANDS.find((command) => command.name === name);
}
