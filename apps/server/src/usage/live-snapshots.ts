import type { ClaudeUsageSnapshot, ClaudeUsageWindow } from '@tavern/claude-usage';
import type { CodexUsageSnapshot, CodexUsageWindow } from '@tavern/codex-usage';

export function createEmptyClaudeUsageSnapshot(capturedAt: Date = new Date()): ClaudeUsageSnapshot {
    return {
        capturedAt: capturedAt.toISOString(),
        extraUsage: null,
        provider: 'claude',
        source: 'anthropic-oauth-usage',
        subscriptionType: null,
        windows: createEmptyClaudeUsageWindows(),
    };
}

export function createEmptyCodexUsageSnapshot(capturedAt: Date = new Date()): CodexUsageSnapshot {
    return {
        capturedAt: capturedAt.toISOString(),
        creditsBalance: null,
        planType: null,
        provider: 'codex',
        source: 'chatgpt-wham-usage',
        windows: createEmptyCodexUsageWindows(),
    };
}

function createEmptyClaudeUsageWindows(): ClaudeUsageWindow[] {
    return [
        createEmptyClaudeUsageWindow('current-session', 'Current session'),
        createEmptyClaudeUsageWindow('current-week-all-models', 'Current week (all models)'),
        createEmptyClaudeUsageWindow('current-week-sonnet', 'Current week (Sonnet only)'),
        createEmptyClaudeUsageWindow('current-week-opus', 'Current week (Opus only)'),
    ];
}

function createEmptyClaudeUsageWindow(
    id: ClaudeUsageWindow['id'],
    label: string
): ClaudeUsageWindow {
    return {
        id,
        label,
        remainingPercent: 100,
        resetsAt: null,
        usedPercent: 0,
    };
}

function createEmptyCodexUsageWindows(): CodexUsageWindow[] {
    return [
        createEmptyCodexUsageWindow('current-session', 'Current session'),
        createEmptyCodexUsageWindow('current-week', 'Current week'),
    ];
}

function createEmptyCodexUsageWindow(id: CodexUsageWindow['id'], label: string): CodexUsageWindow {
    return {
        id,
        label,
        remainingPercent: 100,
        resetAfterSeconds: null,
        resetsAt: null,
        usedPercent: 0,
    };
}
