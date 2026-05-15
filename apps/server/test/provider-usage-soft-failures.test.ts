import { describe, expect, it } from 'bun:test';
import { ClaudeUsageRequestError } from '@tavern/claude-usage';
import { CodexUsageRequestError } from '@tavern/codex-usage';
import {
    getClaudeUsageSoftFailureMessage,
    getCodexUsageSoftFailureMessage,
} from '../../../jobs/provider-usage-soft-failures.ts';

describe('getClaudeUsageSoftFailureMessage', () => {
    it('soft-fails 429 responses', () => {
        expect(
            getClaudeUsageSoftFailureMessage(
                new ClaudeUsageRequestError('Claude usage request failed with HTTP 429', 429)
            )
        ).toBe('Skipped Claude Code usage sync because Anthropic rate limited the request.');
    });
});

describe('getCodexUsageSoftFailureMessage', () => {
    it('soft-fails 429 responses', () => {
        expect(
            getCodexUsageSoftFailureMessage(
                new CodexUsageRequestError('Codex usage request failed with HTTP 429', 429)
            )
        ).toBe('Skipped Codex usage sync because OpenAI rate limited the request.');
    });
});
