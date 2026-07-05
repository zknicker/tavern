import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import type { LearningSignal } from '../memory/extraction-worker.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { supportsLanguageModelForRuntime } from '../models/language-model.ts';
import { runSkillReviewQueueRow } from './review-worker.ts';

export const skillReviewSettleDelayMs = 60 * 1000;
const skillReviewRetryDelayMs = 15 * 60 * 1000;
const skillReviewSweepIntervalMs = 60 * 1000;
const skillReviewMaxAttempts = 3;

export interface SkillReviewQueueRow {
    agent_id: string;
    attempts: number;
    chat_id: string;
    signals_json: string;
    window_end_sequence: number | null;
    window_start_sequence: number | null;
}

export type SkillReviewQueueWorker = (
    row: SkillReviewQueueRow,
    input: { now?: Date }
) => Promise<void>;

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sweepInterval: ReturnType<typeof setInterval> | null = null;
let processingPromise: Promise<{
    completed: number;
    failed: number;
    skipped: number;
}> | null = null;
let queueWorker: SkillReviewQueueWorker = runSkillReviewQueueRow;

export function queueSkillReviewFromSignals(input: {
    agentId: string;
    chatId: string;
    db?: Database;
    endSequence: number;
    now?: Date;
    signals: LearningSignal[];
    startSequence: number;
}) {
    if (input.signals.length === 0 || !canRunSkillReview()) {
        return false;
    }

    const db = input.db ?? getDb();
    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const scheduledFor = new Date(now.getTime() + skillReviewSettleDelayMs).toISOString();

    db.prepare(
        `INSERT INTO skill_review_queue (
            agent_id, chat_id, signals_json, window_start_sequence,
            window_end_sequence, attempts, scheduled_for, created_at, updated_at
         )
         VALUES (
            $agentId, $chatId, $signalsJson, $startSequence,
            $endSequence, 0, $scheduledFor, $now, $now
         )
         ON CONFLICT(agent_id) DO UPDATE SET
            chat_id = excluded.chat_id,
            signals_json = $mergedSignalsJson,
            window_start_sequence = CASE
                WHEN skill_review_queue.window_start_sequence IS NULL THEN excluded.window_start_sequence
                ELSE MIN(skill_review_queue.window_start_sequence, excluded.window_start_sequence)
            END,
            window_end_sequence = CASE
                WHEN skill_review_queue.window_end_sequence IS NULL THEN excluded.window_end_sequence
                ELSE MAX(skill_review_queue.window_end_sequence, excluded.window_end_sequence)
            END,
            attempts = 0,
            scheduled_for = excluded.scheduled_for,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: input.agentId,
            chatId: input.chatId,
            endSequence: input.endSequence,
            mergedSignalsJson: JSON.stringify([
                ...readQueuedSignals(db, input.agentId),
                ...input.signals,
            ]),
            now: nowIso,
            scheduledFor,
            signalsJson: JSON.stringify(input.signals),
            startSequence: input.startSequence,
        })
    );

    scheduleTimer(input.agentId, scheduledFor);
    return true;
}

export async function processDueSkillReviews(input: { now?: Date } = {}) {
    if (processingPromise) {
        return await processingPromise;
    }
    processingPromise = processDueSkillReviewsOnce(input);
    try {
        return await processingPromise;
    } finally {
        processingPromise = null;
    }
}

export function startSkillReviewScheduler() {
    if (sweepInterval) {
        return;
    }
    void processDueSkillReviews().catch(() => {});
    sweepInterval = setInterval(() => {
        void processDueSkillReviews().catch(() => {});
    }, skillReviewSweepIntervalMs);
    sweepInterval.unref?.();
}

export function stopSkillReviewScheduler() {
    if (sweepInterval) {
        clearInterval(sweepInterval);
        sweepInterval = null;
    }
    for (const timer of scheduledTimers.values()) {
        clearTimeout(timer);
    }
    scheduledTimers.clear();
}

export function setSkillReviewQueueWorkerForTesting(worker: SkillReviewQueueWorker | null) {
    queueWorker = worker ?? runSkillReviewQueueRow;
}

export function resetSkillReviewSchedulerForTesting() {
    stopSkillReviewScheduler();
    processingPromise = null;
    queueWorker = runSkillReviewQueueRow;
}

async function processDueSkillReviewsOnce(input: { now?: Date }) {
    if (!(isMemoryEnabled() && canRunSkillReview())) {
        return { completed: 0, failed: 0, skipped: 0 };
    }

    const db = getDb();
    const now = input.now ?? new Date();
    const rows = db
        .prepare(
            `SELECT agent_id, chat_id, signals_json, window_start_sequence,
                    window_end_sequence, attempts
             FROM skill_review_queue
             WHERE scheduled_for <= $now
             ORDER BY scheduled_for ASC, agent_id ASC`
        )
        .all(namedParams({ now: now.toISOString() })) as SkillReviewQueueRow[];

    const counts = { completed: 0, failed: 0, skipped: 0 };
    for (const row of rows) {
        clearScheduledTimer(row.agent_id);
        try {
            await queueWorker(row, { now });
            deleteQueueRow(row.agent_id, db);
            counts.completed += 1;
        } catch {
            retryOrDropReview(row, now, db);
            counts.failed += 1;
        }
    }
    return counts;
}

function canRunSkillReview() {
    return supportsLanguageModelForRuntime(resolveModelCategorySelection('standard'));
}

function readQueuedSignals(db: Database, agentId: string): LearningSignal[] {
    const row = db
        .prepare('SELECT signals_json FROM skill_review_queue WHERE agent_id = $agentId')
        .get(namedParams({ agentId })) as { signals_json: string } | null;
    if (!row) {
        return [];
    }
    const parsed = JSON.parse(row.signals_json) as unknown;
    return Array.isArray(parsed) ? (parsed as LearningSignal[]) : [];
}

function retryOrDropReview(row: SkillReviewQueueRow, now: Date, db: Database) {
    const attempts = row.attempts + 1;
    if (attempts >= skillReviewMaxAttempts) {
        deleteQueueRow(row.agent_id, db);
        return;
    }

    const scheduledFor = new Date(now.getTime() + skillReviewRetryDelayMs).toISOString();
    db.prepare(
        `UPDATE skill_review_queue
         SET scheduled_for = $scheduledFor,
             attempts = $attempts,
             updated_at = $scheduledFor
         WHERE agent_id = $agentId`
    ).run(namedParams({ agentId: row.agent_id, attempts, scheduledFor }));
    scheduleTimer(row.agent_id, scheduledFor);
}

function deleteQueueRow(agentId: string, db: Database) {
    db.prepare('DELETE FROM skill_review_queue WHERE agent_id = $agentId').run(
        namedParams({ agentId })
    );
}

function scheduleTimer(agentId: string, scheduledFor: string) {
    clearScheduledTimer(agentId);
    const delayMs = Math.max(0, new Date(scheduledFor).getTime() - Date.now());
    const timer = setTimeout(() => {
        scheduledTimers.delete(agentId);
        void processDueSkillReviews().catch(() => {});
    }, delayMs);
    timer.unref?.();
    scheduledTimers.set(agentId, timer);
}

function clearScheduledTimer(agentId: string) {
    const timer = scheduledTimers.get(agentId);
    if (timer) {
        clearTimeout(timer);
        scheduledTimers.delete(agentId);
    }
}
