import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
    type AgentThoughtSnapshotRecord as AgentThoughtSnapshot,
    type AgentThoughtSnapshotInsert,
    agentThoughtSnapshotsTable,
} from '../db/schema.ts';

export type { AgentThoughtSnapshot, AgentThoughtSnapshotInsert };

export async function upsertAgentThoughtSnapshots(records: AgentThoughtSnapshotInsert[]) {
    if (records.length === 0) {
        return;
    }

    await db
        .insert(agentThoughtSnapshotsTable)
        .values(records)
        .onConflictDoUpdate({
            target: agentThoughtSnapshotsTable.id,
            set: {
                generatedAt: sql.raw('excluded.generated_at'),
                model: sql.raw('excluded.model'),
                previousSnapshotId: sql.raw('excluded.previous_snapshot_id'),
                promptMarkdown: sql.raw('excluded.prompt_markdown'),
                sessionKeysJson: sql.raw('excluded.session_keys_json'),
                snapshotHour: sql.raw('excluded.snapshot_hour'),
                thoughtsMarkdown: sql.raw('excluded.thoughts_markdown'),
                windowEndAt: sql.raw('excluded.window_end_at'),
                windowStartAt: sql.raw('excluded.window_start_at'),
            },
        });
}

export async function getLatestAgentThoughtSnapshot(
    agentId: string,
    options?: { beforeSnapshotHour?: string }
) {
    const conditions = [eq(agentThoughtSnapshotsTable.agentId, agentId)];

    if (options?.beforeSnapshotHour) {
        conditions.push(lt(agentThoughtSnapshotsTable.snapshotHour, options.beforeSnapshotHour));
    }

    const [record] = await db
        .select()
        .from(agentThoughtSnapshotsTable)
        .where(and(...conditions))
        .orderBy(
            desc(agentThoughtSnapshotsTable.snapshotHour),
            desc(agentThoughtSnapshotsTable.generatedAt)
        )
        .limit(1);

    return record ?? null;
}
