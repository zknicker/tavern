import type { ClaudeUsageSnapshot } from '@tavern/claude-usage';
import type { CodexUsageSnapshot } from '@tavern/codex-usage';
import { getClaudeUsageSnapshot, getCodexUsageSnapshot } from '../storage/provider-usage.ts';
import { toUsageErrorState, type UsageErrorCode } from './live-errors.ts';
import { createEmptyClaudeUsageSnapshot, createEmptyCodexUsageSnapshot } from './live-snapshots.ts';

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
    try {
        const snapshot = await getCodexUsageSnapshot();

        return {
            provider: 'codex',
            snapshot: snapshot ?? createEmptyCodexUsageSnapshot(capturedAt),
            status: 'ok',
        };
    } catch (error) {
        return {
            error: toUsageErrorState(error, 'Codex usage is unavailable.'),
            provider: 'codex',
            status: 'error',
        };
    }
}
