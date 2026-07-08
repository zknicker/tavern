import { type MemoryJobKind, memoryActivityListSchema } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { supportsLanguageModelForRuntime } from '../models/language-model.ts';
import {
    shouldRunSkillCurator,
    skillCuratorCadenceMs,
    skillCuratorMetadataKey,
} from '../skills/curator.ts';
import { isMemoryEnabled } from './settings.ts';

type ActivityKind = Extract<MemoryJobKind, 'curation' | 'dream' | 'extraction' | 'skill_review'>;

interface LastRunRow {
    completed_at: string | null;
    error: string | null;
    id: string;
    started_at: string | null;
    status: string;
}

interface NextRunRow {
    at: string;
}

const activityKinds: ActivityKind[] = ['extraction', 'dream', 'skill_review', 'curation'];

export function getMemoryActivity(input: { now?: Date } = {}) {
    const now = input.now ?? new Date();
    return memoryActivityListSchema.parse({
        activities: activityKinds.map((kind) => {
            const enabled = isActivityEnabled(kind);
            return {
                enabled,
                kind,
                lastRun: readLastRun(kind),
                nextRun: enabled ? readNextRun(kind, now) : null,
            };
        }),
    });
}

function isActivityEnabled(kind: ActivityKind) {
    if (kind === 'curation') {
        return supportsLanguageModelForRuntime(resolveModelCategorySelection('deep'));
    }
    if (kind === 'skill_review') {
        return supportsLanguageModelForRuntime(resolveModelCategorySelection('standard'));
    }
    if (!isMemoryEnabled()) {
        return false;
    }
    const category = kind === 'dream' ? 'standard' : 'fast';
    return supportsLanguageModelForRuntime(resolveModelCategorySelection(category));
}

function readLastRun(kind: ActivityKind) {
    const row = getDb()
        .prepare(
            `SELECT id, status, started_at, completed_at, error
             FROM memory_jobs
             WHERE kind = $kind AND status IN ('running', 'completed', 'failed', 'skipped')
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(namedParams({ kind })) as LastRunRow | undefined;
    if (!row) {
        return null;
    }
    return {
        completedAt: row.completed_at,
        durationMs: durationMs(row.started_at, row.completed_at),
        error: row.error,
        id: row.id,
        startedAt: row.started_at,
        status: row.status,
    };
}

function readNextRun(kind: ActivityKind, now: Date) {
    switch (kind) {
        case 'extraction':
            return readScheduledAt(
                `SELECT scheduled_for AS at
                 FROM memory_extraction_debounces
                 ORDER BY scheduled_for ASC
                 LIMIT 1`,
                'chat activity'
            );
        case 'dream':
            return readScheduledAt(
                `SELECT created_at AS at
                 FROM memory_jobs
                 WHERE kind = 'dream' AND status = 'queued'
                 ORDER BY created_at ASC
                 LIMIT 1`,
                'new episodic evidence'
            );
        case 'skill_review':
            return readScheduledAt(
                `SELECT scheduled_for AS at
                 FROM skill_review_queue
                 ORDER BY scheduled_for ASC
                 LIMIT 1`,
                'learning signals'
            );
        case 'curation':
            return readCurationNextRun(now);
    }
}

function readScheduledAt(sql: string, waitingOn: string) {
    const row = getDb().prepare(sql).get() as NextRunRow | undefined;
    return row
        ? { at: row.at, kind: 'scheduled' as const }
        : { kind: 'waiting' as const, waitingOn };
}

function readCurationNextRun(now: Date) {
    const lastRunAt = readCurationLastRunAt();
    if (!lastRunAt) {
        return {
            at: new Date(now.getTime() + skillCuratorCadenceMs).toISOString(),
            kind: 'scheduled' as const,
        };
    }

    const dueAt = new Date(Date.parse(lastRunAt) + skillCuratorCadenceMs);
    if (dueAt.getTime() > now.getTime()) {
        return { at: dueAt.toISOString(), kind: 'scheduled' as const };
    }

    const gate = shouldRunSkillCurator({ now });
    return gate.ok
        ? { at: now.toISOString(), kind: 'scheduled' as const }
        : { kind: 'waiting' as const, waitingOn: 'runtime idle' };
}

function readCurationLastRunAt() {
    const row = getDb()
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: skillCuratorMetadataKey })) as { value: string } | undefined;
    return row?.value ?? null;
}

function durationMs(startedAt: string | null, completedAt: string | null) {
    if (!(startedAt && completedAt)) {
        return null;
    }
    const duration = Date.parse(completedAt) - Date.parse(startedAt);
    return Number.isFinite(duration) && duration >= 0 ? duration : null;
}
