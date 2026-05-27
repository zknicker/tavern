import type { ClaudeUsageSnapshot } from '@tavern/claude-usage';
import { CodexUsageAuthError, type CodexUsageSnapshot, getCodexUsage } from '@tavern/codex-usage';
import {
    getClaudeUsageSnapshot,
    getCodexUsageSnapshot,
    saveCodexUsageSnapshot,
} from '../storage/provider-usage.ts';
import { toUsageErrorState, type UsageErrorCode } from './live-errors.ts';
import { createEmptyClaudeUsageSnapshot } from './live-snapshots.ts';

export interface LiveUsageErrorState {
    error: {
        code: UsageErrorCode;
        message: string;
        name: string;
    };
    provider: 'claude' | 'codex';
    status: 'error';
}

export interface LiveUsageOkState<TSnapshot> {
    provider: 'claude' | 'codex';
    snapshot: TSnapshot;
    status: 'ok';
}

export type LiveUsageProviderState<TSnapshot> = LiveUsageErrorState | LiveUsageOkState<TSnapshot>;

export async function loadClaudeUsage(
    capturedAt: Date
): Promise<LiveUsageProviderState<ClaudeUsageSnapshot>> {
    try {
        const snapshot = await getClaudeUsageSnapshot();

        return {
            provider: 'claude',
            snapshot: snapshot ?? createEmptyClaudeUsageSnapshot(capturedAt),
            status: 'ok',
        };
    } catch (error) {
        return {
            error: toUsageErrorState(error, 'Claude usage is unavailable.'),
            provider: 'claude',
            status: 'error',
        };
    }
}

export async function loadCodexUsage(
    capturedAt: Date
): Promise<LiveUsageProviderState<CodexUsageSnapshot>> {
    const cachedSnapshot = await loadCachedCodexUsage();

    if (cachedSnapshot) {
        return {
            provider: 'codex',
            snapshot: cachedSnapshot,
            status: 'ok',
        };
    }

    try {
        const snapshot = await getCodexUsage({
            now: capturedAt,
        });

        await saveCodexUsageSnapshot(snapshot);

        return {
            provider: 'codex',
            snapshot,
            status: 'ok',
        };
    } catch (error) {
        if (error instanceof CodexUsageAuthError) {
            return {
                error: toUsageErrorState(error, 'Codex usage is unavailable.'),
                provider: 'codex',
                status: 'error',
            };
        }

        return {
            error: toUsageErrorState(error, 'Codex usage is unavailable.'),
            provider: 'codex',
            status: 'error',
        };
    }
}

async function loadCachedCodexUsage(): Promise<CodexUsageSnapshot | null> {
    try {
        return await getCodexUsageSnapshot();
    } catch {
        return null;
    }
}
