import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runSearch } from './agent-message-search.ts';

function args(input: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--query': 'needle' },
        ...input,
    };
}

describe('agent message search', () => {
    test('forwards filters and renders canonical result blocks with the context hint', async () => {
        const request = vi.fn(async () => ({
            messages: [
                {
                    chat_id: 'cht_dm',
                    content: 'found the needle here',
                    created_at: '2026-07-21T18:02:11.000Z',
                    id: 'msg_1a2b3c4d00000000',
                    sender: { description: null, handle: 'Wren', type: 'agent' as const },
                    sequence: 4,
                    target: 'dm:@Wren',
                },
            ],
        }));
        const output: string[] = [];

        await expect(
            runSearch(
                args({
                    values: {
                        '--limit': '5',
                        '--offset': '10',
                        '--query': 'needle',
                        '--sort': 'recent',
                        '--target': 'dm:@Wren',
                    },
                }),
                {
                    client: { request: request as unknown as AgentApiRequester['request'] },
                    write: (text) => output.push(text),
                }
            )
        ).resolves.toBe(0);

        expect(request).toHaveBeenCalledWith(
            '/api/agent/messages/search',
            expect.anything(),
            expect.objectContaining({
                query: expect.objectContaining({
                    limit: 5,
                    offset: 10,
                    q: 'needle',
                    sort: 'recent',
                    target: 'dm:@Wren',
                }),
            })
        );
        expect(output.join('')).toContain('<result ref="msg:msg_1a2b3c4d00000000">');
        expect(output.join('')).toContain('Source: dm:@Wren');
        expect(output.join('')).toContain('<match>needle</match>');
        expect(output.join('')).toContain(
            'Use grotto message read --target <target> --around <id> to read surrounding context.'
        );
    });
});
