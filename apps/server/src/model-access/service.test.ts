import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as codexUsage from '@tavern/codex-usage';
import { CodexUsageParseError } from '@tavern/codex-usage';
import { listModelAccessStatuses } from './service.ts';

afterEach(() => {
    mock.restore();
});

test('listModelAccessStatuses degrades malformed Codex auth into an error row', async () => {
    spyOn(codexUsage, 'loadCodexCredentials').mockRejectedValue(
        new CodexUsageParseError('Invalid Codex auth file')
    );

    assert.deepEqual(await listModelAccessStatuses(), [
        {
            description: 'Codex local auth is invalid. Sign in with Codex again.',
            id: 'codex',
            source: null,
            state: 'error',
        },
    ]);
});
