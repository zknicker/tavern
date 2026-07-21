import { type AgentApiRequester, createAgentApiClient } from '../agent-api-client.ts';
import {
    agentChannelMembersSchema,
    agentChannelSchema,
    agentServerInfoSchema,
} from '../agent-api-schemas.ts';
import { AgentCliError } from '../agent-error.ts';
import { renderChannelInfo, renderChannelMembers, renderServerInfo } from '../agent-render.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { optionalInteger } from './agent-command-utils.ts';

interface DirectoryDeps {
    client: AgentApiRequester;
    write(text: string): void;
}

export const SERVER_SUBCOMMANDS: SubCommand[] = [
    {
        examples: [
            'grotto server info',
            'grotto server info --channels --joined',
            'grotto server info --agents --query research',
        ],
        flags: [
            { name: '--channels', description: 'List channels' },
            { name: '--agents', description: 'List agents' },
            { name: '--humans', description: 'List humans' },
            { name: '--joined', description: 'Limit channels to joined channels' },
            {
                name: '--query',
                valueName: '<text>',
                description: 'Filter handles and descriptions',
            },
            { name: '--limit', valueName: '<n>', description: 'Maximum rows per section' },
            { name: '--offset', valueName: '<n>', description: 'Server-side row offset' },
        ],
        name: 'info',
        positionals: [],
        run: (args) => runServerInfo(args, defaultDeps()),
        summary: 'Inspect bounded server channels and participant handles',
        usage: 'grotto server info [--channels|--agents|--humans] [--joined] [--query <text>] [--limit <n>] [--offset <n>]',
    },
];

export const CHANNEL_SUBCOMMANDS: SubCommand[] = [
    {
        examples: ['grotto channel info "#general"'],
        flags: [],
        name: 'info',
        positionals: ['<target>'],
        run: (args) => runChannelInfo(args, defaultDeps()),
        summary: 'Inspect one channel and its joined state',
        usage: 'grotto channel info <target>',
    },
    {
        examples: ['grotto channel members "#general"'],
        flags: [],
        name: 'members',
        positionals: ['<target>'],
        run: (args) => runChannelMembers(args, defaultDeps()),
        summary: 'List one channel’s members and role labels',
        usage: 'grotto channel members <target>',
    },
];

export async function runServerInfo(args: ParsedArgs, deps: DirectoryDeps): Promise<number> {
    const response = await deps.client.request('/api/agent/server', agentServerInfoSchema, {
        query: {
            agents: flagOrUndefined(args, '--agents'),
            channels: flagOrUndefined(args, '--channels'),
            humans: flagOrUndefined(args, '--humans'),
            joined: flagOrUndefined(args, '--joined'),
            limit: optionalInteger(args, '--limit', { minimum: 1 }),
            offset: optionalInteger(args, '--offset', { minimum: 0 }),
            query: args.values['--query'],
        },
    });
    deps.write(
        renderServerInfo(response, {
            joined: Boolean(args.flags['--joined']),
            query: args.values['--query'],
        })
    );
    return 0;
}

export async function runChannelInfo(args: ParsedArgs, deps: DirectoryDeps): Promise<number> {
    const target = channelTarget(args);
    const response = await deps.client.request('/api/agent/channels/info', agentChannelSchema, {
        query: { target },
    });
    deps.write(renderChannelInfo(response));
    return 0;
}

export async function runChannelMembers(args: ParsedArgs, deps: DirectoryDeps): Promise<number> {
    const target = channelTarget(args);
    const response = await deps.client.request(
        '/api/agent/channels/members',
        agentChannelMembersSchema,
        { query: { target } }
    );
    deps.write(renderChannelMembers(response));
    return 0;
}

function channelTarget(args: ParsedArgs): string {
    const target = args.positionals[0];
    if (!(target && /^#[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/u.test(target))) {
        throw new AgentCliError('INVALID_TARGET', 'A #channel target is required.');
    }
    return target;
}

function flagOrUndefined(args: ParsedArgs, flag: string): true | undefined {
    return args.flags[flag] ? true : undefined;
}

function defaultDeps(): DirectoryDeps {
    return {
        client: createAgentApiClient(),
        write: (text) => process.stdout.write(text),
    };
}
