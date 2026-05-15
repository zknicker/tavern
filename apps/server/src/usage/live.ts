import type { ClaudeUsageSnapshot } from '@tavern/claude-usage';
import type { CodexUsageSnapshot } from '@tavern/codex-usage';
import {
    type LiveUsageOpenRouterState,
    type LiveUsageProviderState,
    loadClaudeUsage,
    loadCodexUsage,
    loadOpenRouterActivity,
} from './live-loaders.ts';

export type {
    LiveUsageErrorState,
    LiveUsageOkState,
    LiveUsageOpenRouterState,
    LiveUsageProviderState,
} from './live-loaders.ts';
export {
    createEmptyClaudeUsageSnapshot,
    createEmptyCodexUsageSnapshot,
} from './live-snapshots.ts';

export interface LiveUsageOverview {
    capturedAt: string;
    claude: LiveUsageProviderState<ClaudeUsageSnapshot>;
    codex: LiveUsageProviderState<CodexUsageSnapshot>;
    openRouter: LiveUsageOpenRouterState;
}

export async function getLiveUsageOverview(): Promise<LiveUsageOverview> {
    const capturedAt = new Date();
    const [claude, codex, openRouter] = await Promise.all([
        loadClaudeUsage(capturedAt),
        loadCodexUsage(capturedAt),
        loadOpenRouterActivity(capturedAt),
    ]);

    return {
        capturedAt: capturedAt.toISOString(),
        claude,
        codex,
        openRouter,
    };
}
