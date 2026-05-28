import type { CortexSourceRef } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { createCortexId } from './ids';
import { nowIso } from './rows';

export function writeCortexAudit(
    db: Database,
    input: {
        kind: string;
        recordRefs: string[];
        sourceRefs: CortexSourceRef[];
        metadata?: Record<string, unknown>;
        status: 'error' | 'skipped' | 'success';
        summary: string;
    }
): string {
    const id = createCortexId('ctxa');
    db.prepare(
        `INSERT INTO cortex_audit_events
         (id, kind, status, record_refs_json, source_refs_json, metadata_json, summary, created_at)
         VALUES ($id, $kind, $status, $recordRefs, $sourceRefs, $metadata, $summary, $createdAt)`
    ).run(
        namedParams({
            createdAt: nowIso(),
            id,
            kind: input.kind,
            metadata: JSON.stringify(input.metadata ?? {}),
            recordRefs: JSON.stringify(input.recordRefs),
            sourceRefs: JSON.stringify(input.sourceRefs),
            status: input.status,
            summary: input.summary,
        })
    );
    return id;
}
