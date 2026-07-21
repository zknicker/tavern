import type { CliCommand } from './registry.ts';

/** Commands available in agent shells; everything else is operator-only there. */
const AGENT_SURFACE_COMMANDS = new Set(['message', 'inbox', 'server', 'channel', 'help']);

export function isAgentSurfaceCommand(name: string): boolean {
    return AGENT_SURFACE_COMMANDS.has(name);
}

export const messageCommand: CliCommand = {
    examples: [
        'grotto message read --target "#general"',
        'grotto message search --query "release notes"',
        'grotto message send --target "#general" <<\'GROTTOMSG\'',
    ],
    flags: [],
    group: true,
    name: 'message',
    section: 'Messages',
    summary: 'Send, read, search, resolve, or check messages',
    usage: 'grotto message <send|read|search|resolve|check> [flags]',
    async run(_args, raw) {
        const [{ MESSAGE_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-message'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('message', MESSAGE_SUBCOMMANDS, raw);
    },
};

export const inboxCommand: CliCommand = {
    examples: ['grotto inbox check'],
    flags: [],
    group: true,
    name: 'inbox',
    section: 'Inbox',
    summary: 'Inspect pending message delivery',
    usage: 'grotto inbox <check>',
    async run(_args, raw) {
        const [{ INBOX_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-inbox'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('inbox', INBOX_SUBCOMMANDS, raw);
    },
};

export const serverInfoCommand: CliCommand = {
    examples: ['grotto server info', 'grotto server info --channels --joined'],
    flags: [],
    group: true,
    name: 'server',
    section: 'Directory',
    summary: 'Inspect server channels and participant handles',
    usage: 'grotto server <info> [flags]',
    async run(_args, raw) {
        const [{ SERVER_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-directory'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('server', SERVER_SUBCOMMANDS, raw);
    },
};

export const channelCommand: CliCommand = {
    examples: ['grotto channel info "#general"', 'grotto channel members "#general"'],
    flags: [],
    group: true,
    name: 'channel',
    section: 'Directory',
    summary: 'Inspect channel details and members',
    usage: 'grotto channel <info|members> <target>',
    async run(_args, raw) {
        const [{ CHANNEL_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-directory'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('channel', CHANNEL_SUBCOMMANDS, raw);
    },
};
