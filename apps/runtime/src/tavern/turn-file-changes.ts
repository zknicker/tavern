import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import type { WorkspaceFileChange, WorkspaceFileChangeKind } from '../workspace/snapshot';
import { getAgentTurnOrThrow } from './agent-turn-store';

// Durable per-turn file-change evidence (specs/chat-timeline.md): which files
// a turn created, modified, or deleted in the agent workspace, with bounded
// before/after text for diff rendering. Queried on demand by the changed-files
// drawer; the transcript row carries only the summary.

export interface AgentTurnFileEvidence {
    capturedAt: string;
    changes: WorkspaceFileChange[];
    truncated: boolean;
}

const maxPersistedChanges = 400;

interface TurnFileChangeRow {
    additions: number;
    after_size: null | number;
    after_text: null | string;
    before_size: null | number;
    before_text: null | string;
    change: WorkspaceFileChangeKind;
    deletions: number;
    omitted: 'binary' | 'too-large' | null;
    path: string;
}

export function recordAgentTurnFileChanges(
    input: {
        changes: WorkspaceFileChange[];
        now?: string;
        runId: string;
        truncated: boolean;
    },
    db: Database = getDb()
): AgentTurnFileEvidence {
    const turn = getAgentTurnOrThrow(input.runId, db);
    const now = input.now ?? new Date().toISOString();
    const changes = input.changes.slice(0, maxPersistedChanges);
    const truncated = input.truncated || input.changes.length > maxPersistedChanges;

    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM agent_turn_file_changes WHERE run_id = $runId').run(
            namedParams({ runId: input.runId })
        );
        const insert = db.prepare(
            `INSERT INTO agent_turn_file_changes
             (run_id, path, change, before_text, after_text, omitted, before_size,
              after_size, additions, deletions, created_at)
             VALUES ($runId, $path, $change, $beforeText, $afterText, $omitted,
              $beforeSize, $afterSize, $additions, $deletions, $createdAt)`
        );
        for (const change of changes) {
            insert.run(
                namedParams({
                    additions: change.additions,
                    afterSize: change.afterSize,
                    afterText: change.afterText,
                    beforeSize: change.beforeSize,
                    beforeText: change.beforeText,
                    change: change.change,
                    createdAt: now,
                    deletions: change.deletions,
                    omitted: change.omitted,
                    path: change.path,
                    runId: input.runId,
                })
            );
        }
        db.prepare(
            `UPDATE agent_turns
             SET metadata_json = $metadataJson,
                 updated_at = $now
             WHERE id = $id`
        ).run(
            namedParams({
                id: input.runId,
                metadataJson: JSON.stringify({
                    ...turn.metadata,
                    fileEvidence: { capturedAt: now, changeCount: changes.length, truncated },
                }),
                now,
            })
        );
        db.exec('COMMIT');
    } catch (error) {
        try {
            db.exec('ROLLBACK');
        } catch {
            // Keep the original transaction failure visible.
        }
        throw error;
    }

    return { capturedAt: now, changes, truncated };
}

export function getAgentTurnFileEvidence(
    runId: string,
    db: Database = getDb()
): AgentTurnFileEvidence | null {
    const turn = db
        .prepare('SELECT metadata_json FROM agent_turns WHERE id = $runId LIMIT 1')
        .get(namedParams({ runId })) as { metadata_json: string } | null;
    if (!turn) {
        return null;
    }
    const metadata = JSON.parse(turn.metadata_json) as Record<string, unknown>;
    const marker = metadata.fileEvidence;
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)) {
        return null;
    }
    const { capturedAt, truncated } = marker as { capturedAt?: unknown; truncated?: unknown };

    const rows = db
        .prepare(
            `SELECT path, change, before_text, after_text, omitted, before_size,
                    after_size, additions, deletions
             FROM agent_turn_file_changes
             WHERE run_id = $runId
             ORDER BY path ASC`
        )
        .all(namedParams({ runId })) as TurnFileChangeRow[];

    return {
        capturedAt: typeof capturedAt === 'string' ? capturedAt : '',
        changes: rows.map(rowToFileChange),
        truncated: truncated === true,
    };
}

function rowToFileChange(row: TurnFileChangeRow): WorkspaceFileChange {
    return {
        additions: row.additions,
        afterSize: row.after_size,
        afterText: row.after_text,
        beforeSize: row.before_size,
        beforeText: row.before_text,
        change: row.change,
        deletions: row.deletions,
        omitted: row.omitted,
        path: row.path,
    };
}
