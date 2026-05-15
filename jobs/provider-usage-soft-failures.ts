import { ClaudeUsageRequestError } from '../packages/claude-usage/src/index.ts';
import { CodexUsageRequestError } from '../packages/codex-usage/src/index.ts';

export function getClaudeUsageSoftFailureMessage(error: unknown) {
    if (!(error instanceof ClaudeUsageRequestError) || error.status !== 429) {
        return null;
    }

    return 'Skipped Claude Code usage sync because Anthropic rate limited the request.';
}

export function getCodexUsageSoftFailureMessage(error: unknown) {
    if (!(error instanceof CodexUsageRequestError) || error.status !== 429) {
        return null;
    }

    return 'Skipped Codex usage sync because OpenAI rate limited the request.';
}
