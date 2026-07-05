import crypto from 'node:crypto';
import type { AgentRuntimeModelName } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { fileChangesFromCuratorActions, type SkillCuratorActions } from './curator-report.ts';
import type { SkillLifecycleTransition } from './lifecycle.ts';

export const skillCuratorMetadataKey = 'skills:last-curation-at';

export interface CuratorJobOutcome {
    actions: SkillCuratorActions;
    model: AgentRuntimeModelName;
    report: { text: string; toolErrors: Array<{ error: string; tool: string }> };
    transcript: unknown;
    usage: unknown;
}

export function createCuratorJob(input: {
    agentId: string;
    db: Database;
    model: AgentRuntimeModelName;
    now: Date;
}) {
    const jobId = `memcuration_${crypto.randomUUID().replaceAll('-', '')}`;
    input.db
        .prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, model_category, model_json,
                metadata_json, created_at, updated_at, started_at
             )
             VALUES (
                $jobId, 'curation', 'running', $agentId, 'deep', $modelJson,
                '{}', $now, $now, $now
             )`
        )
        .run(
            namedParams({
                agentId: input.agentId,
                jobId,
                modelJson: JSON.stringify(input.model),
                now: input.now.toISOString(),
            })
        );
    return jobId;
}

export function completeCuratorJob(
    db: Database,
    jobId: string,
    input: { now: Date; outcome: CuratorJobOutcome; transitions: SkillLifecycleTransition[] }
) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'completed',
             model_json = $modelJson,
             file_changes_json = $fileChangesJson,
             usage_json = $usageJson,
             transcript_json = $transcriptJson,
             metadata_json = $metadataJson,
             completed_at = $now,
             updated_at = $now
         WHERE id = $jobId`
    ).run(
        namedParams({
            fileChangesJson: JSON.stringify(fileChangesFromCuratorActions(input.outcome.actions)),
            jobId,
            metadataJson: JSON.stringify({
                ...input.outcome.actions,
                report: input.outcome.report,
                transitions: input.transitions,
            }),
            modelJson: JSON.stringify(input.outcome.model),
            now: input.now.toISOString(),
            transcriptJson: JSON.stringify(input.outcome.transcript),
            usageJson: JSON.stringify(input.outcome.usage ?? {}),
        })
    );
}

export function skipCuratorJob(
    db: Database,
    jobId: string,
    input: { now: Date; reason: string; transitions: SkillLifecycleTransition[] }
) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'skipped',
             metadata_json = $metadataJson,
             completed_at = $now,
             updated_at = $now
         WHERE id = $jobId`
    ).run(
        namedParams({
            jobId,
            metadataJson: JSON.stringify({
                reason: input.reason,
                report: { text: input.reason, toolErrors: [] },
                transitions: input.transitions,
            }),
            now: input.now.toISOString(),
        })
    );
}

export function failCuratorJob(db: Database, jobId: string, error: unknown, now: Date) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'failed',
             error = $error,
             completed_at = $now,
             updated_at = $now
         WHERE id = $jobId`
    ).run(
        namedParams({
            error: error instanceof Error ? error.message : String(error),
            jobId,
            now: now.toISOString(),
        })
    );
}

export function readRuntimeMetadata(key: string, db: Database) {
    const row = db
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key })) as { value: string } | null;
    return row?.value ?? null;
}

export function writeRuntimeMetadata(key: string, value: string, db: Database) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO runtime_metadata (key, value, updated_at)
         VALUES ($key, $value, $now)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
    ).run(namedParams({ key, now, value }));
}

export function hasRunningAgentTurn(db: Database) {
    return Boolean(db.prepare("SELECT 1 FROM agent_turns WHERE status = 'running' LIMIT 1").get());
}

export function hasQueuedSkillReview(db: Database) {
    return Boolean(db.prepare('SELECT 1 FROM skill_review_queue LIMIT 1').get());
}
