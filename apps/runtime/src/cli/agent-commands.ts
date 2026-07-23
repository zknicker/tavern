import type { CliCommand } from './registry.ts';

/** Commands available in agent shells; everything else is operator-only there. */
const AGENT_SURFACE_COMMANDS = new Set([
    'message',
    'inbox',
    'server',
    'channel',
    'thread',
    'task',
    'attachment',
    'profile',
    'reminder',
    'skill',
    'help',
]);

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
    usage: 'grotto message <send|read|search|resolve|check|react> [flags]',
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

export const threadCommand: CliCommand = {
    examples: ['grotto thread unfollow --target "#general:1a2b3c4d"'],
    flags: [],
    group: true,
    name: 'thread',
    section: 'Messages',
    summary: 'Thread attention operations',
    usage: 'grotto thread <unfollow> [flags]',
    async run(_args, raw) {
        const [{ THREAD_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-thread'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('thread', THREAD_SUBCOMMANDS, raw);
    },
};

export const taskCommand: CliCommand = {
    examples: [
        'grotto task list --target "#general"',
        'grotto task claim --target "#general" --number 1',
    ],
    flags: [],
    group: true,
    name: 'task',
    section: 'Tasks',
    summary: 'List, create, claim, and update task-messages',
    usage: 'grotto task <list|create|claim|unclaim|update> [flags]',
    async run(_args, raw) {
        const [{ TASK_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-task'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('task', TASK_SUBCOMMANDS, raw);
    },
};

export const reminderCommand: CliCommand = {
    examples: [
        'grotto reminder list',
        'grotto reminder schedule --title "check CI" --delay-seconds 1800 --message-id 1a2b3c4d',
    ],
    flags: [],
    group: true,
    name: 'reminder',
    section: 'Reminders',
    summary: 'Schedule, snooze, update, cancel, and audit wake-up reminders',
    usage: 'grotto reminder <schedule|list|snooze|update|cancel|log> [flags]',
    async run(_args, raw) {
        const [{ REMINDER_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-reminder'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('reminder', REMINDER_SUBCOMMANDS, raw);
    },
};

export const attachmentCommand: CliCommand = {
    examples: ['grotto attachment upload --path ./report.pdf', 'grotto attachment view att_1a2b3c'],
    flags: [],
    group: true,
    name: 'attachment',
    section: 'Attachments',
    summary: 'Upload and download message attachments',
    usage: 'grotto attachment <upload|view> [flags]',
    async run(_args, raw) {
        const [{ ATTACHMENT_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-attachment'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('attachment', ATTACHMENT_SUBCOMMANDS, raw);
    },
};

export const profileCommand: CliCommand = {
    examples: [
        'grotto profile show',
        'grotto profile update --description "Resident investigator"',
    ],
    flags: [],
    group: true,
    name: 'profile',
    section: 'Profile',
    summary: 'Show profiles and update your description',
    usage: 'grotto profile <show|update> [flags]',
    async run(_args, raw) {
        const [{ PROFILE_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-profile'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('profile', PROFILE_SUBCOMMANDS, raw);
    },
};

export const skillCommand: CliCommand = {
    examples: ['grotto skill list', 'grotto skill view release-checks'],
    flags: [],
    group: true,
    name: 'skill',
    section: 'Skills',
    summary: 'List, inspect, create, and edit shared skills',
    usage: 'grotto skill <list|view|create|patch|write-file> [flags]',
    async run(_args, raw) {
        const [{ SKILL_SUBCOMMANDS }, { dispatchSubcommand }] = await Promise.all([
            import('./commands/agent-skill'),
            import('./subcommand'),
        ]);
        return await dispatchSubcommand('skill', SKILL_SUBCOMMANDS, raw);
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
