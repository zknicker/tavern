import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runThreadUnfollow } from './agent-thread.ts';

describe('agent thread commands', () => {
    test('describes current unfollow behavior without promising delivery filtering', async () => {
        const output: string[] = [];
        const request = vi.fn(async () => ({ target: '#general:1a2b3c4d', unfollowed: true }));

        await expect(
            runThreadUnfollow(args(), {
                client: { request: request as unknown as AgentApiRequester['request'] },
                write: (text) => output.push(text),
            })
        ).resolves.toBe(0);

        expect(output.join('')).toContain('followed-thread attention state');
        expect(output.join('')).toContain('Current message delivery is unchanged.');
        expect(output.join('')).not.toContain('delivery for this thread has stopped');
    });
});

function args(): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--target': '#general:1a2b3c4d' },
    };
}
