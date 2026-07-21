import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runChannelMembers, runServerInfo } from './agent-directory.ts';

function args(input: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: {},
        ...input,
    };
}

function requester(response: unknown) {
    const request = vi.fn(async () => response);
    return {
        client: { request: request as unknown as AgentApiRequester['request'] },
        request,
    };
}

describe('agent directory commands', () => {
    test('forwards server-side filters and renders Raft-shaped sections', async () => {
        const { client, request } = requester({
            agents: [{ description: 'resident generalist', handle: 'Wren' }],
            channels: [
                { description: 'Team chat', handle: 'general', joined: true, memberCount: 2 },
            ],
            hasMore: { agents: false, channels: true, humans: false },
            humans: [],
            limit: 10,
            offset: 5,
            total: { agents: 1, channels: 20, humans: 0 },
        });
        const output: string[] = [];

        await expect(
            runServerInfo(
                args({
                    flags: { '--channels': true, '--joined': true },
                    values: { '--limit': '10', '--offset': '5', '--query': 'gen' },
                }),
                { client, write: (text) => output.push(text) }
            )
        ).resolves.toBe(0);

        expect(request).toHaveBeenCalledWith(
            '/api/agent/server',
            expect.anything(),
            expect.objectContaining({
                query: expect.objectContaining({
                    channels: true,
                    joined: true,
                    limit: 10,
                    offset: 5,
                    query: 'gen',
                }),
            })
        );
        expect(output.join('')).toContain('## Server summary');
        expect(output.join('')).toContain('#general [joined] — Team chat');
        expect(output.join('')).toContain('@Wren — resident generalist');
        expect(output.join('')).toContain(
            "Next: grotto server info --channels --joined --query 'gen' --offset 15 --limit 10"
        );
    });

    test('renders channel members with role labels', async () => {
        const { client } = requester({
            members: [{ description: 'operator', handle: 'zach', role: 'human' }],
            target: '#general',
        });
        const output: string[] = [];

        await expect(
            runChannelMembers(args({ positionals: ['#general'] }), {
                client,
                write: (text) => output.push(text),
            })
        ).resolves.toBe(0);
        expect(output.join('')).toContain('@zach [human] — operator');
    });
});
