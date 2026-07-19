import { getDb } from '../db/connection';
import { log } from '../log.ts';
import { getAgentWorkspaceSource } from '../workspace/instructions.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshot.ts';
import { captureWorkspaceSnapshot, diffWorkspaceSnapshots } from '../workspace/snapshot.ts';
import { upsertResponseActivity } from './chat-api/index.ts';
import { recordAgentTurnFileChanges } from './turn-file-changes.ts';

// Turn file-change evidence: a workspace snapshot brackets every turn, and the
// compared pair settles as a workspace_changes tool activity plus durable
// before/after rows. Snapshot-compare (not tool-call derivation) because
// harness file-tool names differ per adapter and shell writes are invisible
// to tool arguments.

export const workspaceChangesToolName = 'workspace_changes';

export function fileChangesActivityIdForRun(runId: string) {
    return `act_${runId.replace(/[^A-Za-z0-9_-]/gu, '_')}_files`;
}

// Best-effort: a turn without a resolvable workspace simply has no file
// evidence. Never blocks the turn.
export async function captureTurnWorkspaceBaseline(
    agentId: string
): Promise<null | WorkspaceSnapshot> {
    try {
        const source = getAgentWorkspaceSource(getDb(), agentId);
        if (!source) {
            return null;
        }
        return await captureWorkspaceSnapshot(source.workspaceDir);
    } catch (error) {
        log.warn('Turn workspace baseline capture failed', { agentId, err: error });
        return null;
    }
}

export async function settleTurnFileEvidence(input: {
    agentId: string;
    agentSessionId: string;
    baseline: null | WorkspaceSnapshot;
    chatId: string;
    requestMessageId: string;
    responseId: string;
    runId: string;
}): Promise<null | string> {
    if (!input.baseline) {
        return null;
    }
    try {
        const source = getAgentWorkspaceSource(getDb(), input.agentId);
        if (!source) {
            return null;
        }
        const after = await captureWorkspaceSnapshot(source.workspaceDir);
        const changes = diffWorkspaceSnapshots(input.baseline, after);
        if (changes.length === 0) {
            return null;
        }

        const evidence = recordAgentTurnFileChanges({
            changes,
            runId: input.runId,
            truncated: input.baseline.truncated || after.truncated,
        });
        const now = evidence.capturedAt;
        const activityId = fileChangesActivityIdForRun(input.runId);
        upsertResponseActivity(input.chatId, input.responseId, {
            completed_at: now,
            id: activityId,
            kind: 'tool_call',
            metadata: {
                runtime: {
                    agentId: input.agentId,
                    agentSessionId: input.agentSessionId,
                    engine: 'agent-engine',
                    messageId: input.requestMessageId,
                    runId: input.runId,
                    source: 'agent-engine',
                },
                tool: {
                    // The drawer fetches before/after contents on demand via
                    // the turn file-changes route keyed by this runId.
                    arguments: {
                        changes: evidence.changes.map((change) => ({
                            additions: change.additions,
                            change: change.change,
                            deletions: change.deletions,
                            omitted: change.omitted,
                            path: change.path,
                        })),
                        runId: input.runId,
                        truncated: evidence.truncated,
                    },
                    name: workspaceChangesToolName,
                },
                toolName: workspaceChangesToolName,
            },
            started_at: now,
            status: 'completed',
            title: changedFilesTitle(evidence.changes.length),
        });
        return activityId;
    } catch (error) {
        log.warn('Turn file-change evidence failed', { err: error, runId: input.runId });
        return null;
    }
}

function changedFilesTitle(count: number) {
    return count === 1 ? 'Changed 1 file' : `Changed ${count} files`;
}
