import { describe, expect, test, vi } from 'vitest';
import type { AgentApiRequester } from '../agent-api-client.ts';
import type { ParsedArgs } from '../parse.ts';
import { runAttachmentUpload } from './agent-attachment.ts';

describe('agent attachment commands', () => {
    test('reports a missing upload file as INVALID_ARG', async () => {
        const request = vi.fn();
        const result = runAttachmentUpload(args(), {
            client: { request: request as unknown as AgentApiRequester['request'] },
            readFile: async () => Buffer.alloc(0),
            stat: async () => {
                throw new Error('ENOENT');
            },
            write: () => undefined,
            writeFile: async () => undefined,
        });

        await expect(result).rejects.toMatchObject({ code: 'INVALID_ARG' });
        expect(request).not.toHaveBeenCalled();
    });
});

function args(): ParsedArgs {
    return {
        flags: {},
        help: false,
        positionals: [],
        valueLists: {},
        values: { '--path': './missing.txt' },
    };
}
