import type { CodexUsageSnapshot } from '@tavern/codex-usage';
import {
    type LiveUsageOpenRouterState,
    type LiveUsageProviderState,
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
    codex: LiveUsageProviderState<CodexUsageSnapshot>;
    openRouter: LiveUsageOpenRouterState;
}

export async function getLiveUsageOverview(): Promise<LiveUsageOverview> {
    const capturedAt = new Date();
    const [codex, openRouter] = await Promise.all([
        loadCodexUsage(capturedAt),
        loadOpenRouterActivity(capturedAt),
    ]);

    return {
        capturedAt: capturedAt.toISOString(),
        codex,
        openRouter,
    };
}
