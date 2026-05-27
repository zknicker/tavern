import { describe, expect, it } from 'bun:test';
import { CodexUsageRequestError } from '@tavern/codex-usage';
import { getCodexUsageSoftFailureMessage } from '../../../jobs/provider-usage-soft-failures.ts';

describe('getCodexUsageSoftFailureMessage', () => {
    it('soft-fails 429 responses', () => {
        expect(
            getCodexUsageSoftFailureMessage(
                new CodexUsageRequestError('Codex usage request failed with HTTP 429', 429)
            )
        ).toBe('Skipped Codex usage sync because OpenAI rate limited the request.');
    });
});
