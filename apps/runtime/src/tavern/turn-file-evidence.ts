import { getDb } from '../db/connection';
import { log } from '../log.ts';
import { getAgentWorkspaceSource } from '../workspace/instructions.ts';
import type { WorkspaceSnapshot } from '../workspace/snapshot.ts';
import { captureWorkspaceSnapshot, diffWorkspaceSnapshots } from '../workspace/snapshot.ts';
import { recordAgentTurnFileChanges } from './turn-file-changes.ts';

// Turn file-change evidence: a workspace snapshot brackets every turn, and
// the compared pair settles as durable before/after rows keyed by runId —
// agent-level execution evidence for the agent detail panel (I1).
// Snapshot-compare (not tool-call derivation) because harness file-tool
// names differ per adapter and shell writes are invisible to tool arguments.

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
    baseline: null | WorkspaceSnapshot;
    runId: string;
}): Promise<void> {
    if (!input.baseline) {
        return;
    }
    try {
        const source = getAgentWorkspaceSource(getDb(), input.agentId);
        if (!source) {
            return;
        }
        const after = await captureWorkspaceSnapshot(source.workspaceDir);
        const changes = diffWorkspaceSnapshots(input.baseline, after);
        if (changes.length === 0) {
            return;
        }
        recordAgentTurnFileChanges({
            changes,
            runId: input.runId,
            truncated: input.baseline.truncated || after.truncated,
        });
    } catch (error) {
        log.warn('Turn file-change evidence failed', { err: error, runId: input.runId });
    }
}
