import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import { runRead, runSend } from './agent-message.ts';

const message = {
    chat_id: 'cht_general',
    content: 'hello',
    created_at: '2026-07-21T18:02:11.000Z',
    id: 'msg_1a2b3c4d00000000',
    sender: { description: null, handle: 'wren', type: 'agent' as const },
    sequence: 1,
};

function args(input: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--target': '#general' },
        ...input,
    };
}

function harness(response: unknown = { message, recentUnread: [], state: 'sent' }) {
    const output: string[] = [];
    const request = vi.fn(async () => response);
    const deps: Parameters<typeof runSend>[1] = {
        client: { request: request as unknown as AgentApiRequester['request'] },
        compositionId: 'cmp_live',
        readStdin: async () => 'hello from stdin\n',
        stdinIsTty: false,
        write: (text) => output.push(text),
    };
    return { deps, output, request };
}

describe('agent message send', () => {
    test.each([
        [args({ flags: { '--content': true } }), 'CONTENT_FLAG_UNSUPPORTED'],
        [args({ positionals: ['hello'] }), 'POSITIONAL_CONTENT_UNSUPPORTED'],
        [args({ flags: { '--anyway': true } }), 'SEND_DRAFT_ANYWAY_REQUIRES_SEND_DRAFT'],
        [
            args({
                flags: { '--send-draft': true },
                valueLists: { '--attachment-id': ['att_one'] },
                values: { '--attachment-id': 'att_one', '--target': '#general' },
            }),
            'SEND_DRAFT_ATTACHMENTS_UNSUPPORTED',
        ],
    ])('returns stable local validation codes', async (input, code) => {
        const { deps } = harness();
        const error = await runSend(input, deps).catch((caught) => caught);
        expect(error).toBeInstanceOf(AgentCliError);
        expect(error.code).toBe(code);
    });

    test('rejects TTY and blank stdin', async () => {
        const { deps } = harness();
        deps.stdinIsTty = true;
        const error = await runSend(args(), deps).catch((caught) => caught);
        expect(error).toMatchObject({ code: 'MISSING_CONTENT' });
        expect(error.options.nextAction).toContain('GROTTOMSG');
    });

    test('rejects stdin with --send-draft', async () => {
        const { deps } = harness();
        const error = await runSend(args({ flags: { '--send-draft': true } }), deps).catch(
            (caught) => caught
        );
        expect(error).toMatchObject({ code: 'SEND_DRAFT_STDIN_UNSUPPORTED' });
    });

    test('posts stdin, repeated attachments, and composition id', async () => {
        const { deps, output, request } = harness();
        await expect(
            runSend(
                args({
                    valueLists: { '--attachment-id': ['att_one', 'att_two'] },
                    values: { '--attachment-id': 'att_two', '--target': '#general' },
                }),
                deps
            )
        ).resolves.toBe(0);

        expect(request).toHaveBeenCalledWith(
            '/api/agent/messages/send',
            expect.anything(),
            expect.objectContaining({
                body: {
                    attachmentIds: ['att_one', 'att_two'],
                    compositionId: 'cmp_live',
                    content: 'hello from stdin\n',
                    target: '#general',
                },
                method: 'POST',
            })
        );
        expect(output.join('')).toContain('Message sent to #general. Message ID:');
        expect(output.join('')).toContain('#general:1a2b3c4d');
    });
});

describe('agent message read', () => {
    test('rejects multiple anchors locally', async () => {
        const { deps } = harness();
        const error = await runRead(
            args({ values: { '--after': '2', '--before': '8', '--target': '#general' } }),
            deps
        ).catch((caught) => caught);
        expect(error).toMatchObject({ code: 'INVALID_ARG' });
    });
});
