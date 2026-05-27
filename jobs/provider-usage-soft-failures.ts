import { CodexUsageRequestError } from '../packages/codex-usage/src/index.ts';

export function getCodexUsageSoftFailureMessage(error: unknown) {
    if (!(error instanceof CodexUsageRequestError) || error.status !== 429) {
        return null;
    }

    return 'Skipped Codex usage sync because OpenAI rate limited the request.';
}
