import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { supportsLanguageModelForRuntime } from '../models/language-model.ts';
import type { AgentTurn } from '../tavern/agent-turn-store.ts';
import type { MessageRow } from '../tavern/chat-api/types.ts';
import { maybeQueueMemoryDreamForAgent } from './dreaming.ts';
import {
    type MemoryExtractionMessage,
    type MemoryExtractionOutcome,
    type MemoryExtractionWorker,
    memoryExtractionChunkChars,
    memoryExtractionChunkMessageLimit,
    runAiSdkMemoryExtraction,
} from './extraction-worker.ts';
import { isMemoryEnabled } from './settings.ts';

export const memoryExtractionIdleDebounceMs = 5 * 60 * 1000;
export const memoryExtractionRetryDelayMs = 15 * 60 * 1000;
export const memoryExtractionSweepIntervalMs = 60 * 1000;
export const memoryExtractionMaxAttempts = 3;

interface DebounceRow {
    agent_id: string;
    agent_participant_id: string;
    attempts: number;
    chat_id: string;
    target_sequence: number;
}

interface ProcessResult {
    jobId: string | null;
    status: 'completed' | 'failed' | 'skipped';
}

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sweepInterval: ReturnType<typeof setInterval> | null = null;
let processingPromise: Promise<{ completed: number; failed: number; skipped: number }> | null =
    null;
let extractionWorker: MemoryExtractionWorker = runAiSdkMemoryExtraction;

export function scheduleMemoryExtractionForTurn(
    turn: AgentTurn,
    input: { debounceMs?: number; now?: Date } = {}
) {
    if (turn.status !== 'completed' || !isMemoryEnabled()) {
        return false;
    }
    // Don't queue work the workers cannot run; the memoryWorkers capability
    // surfaces the fix instead of filling history with doomed retries.
    if (!supportsLanguageModelForRuntime(resolveModelCategorySelection('fast'))) {
        return false;
    }

    const db = getDb();
    const targetSequence = getChatLastMessageSequence(turn.chatId, db);
    if (targetSequence <= 0) {
        return false;
    }

    const now = input.now ?? new Date();
    const nowIso = now.toISOString();
    const scheduledFor = new Date(
        now.getTime() + (input.debounceMs ?? memoryExtractionIdleDebounceMs)
    ).toISOString();

    db.prepare(
        `INSERT INTO memory_extraction_debounces (
            chat_id,
            agent_participant_id,
            agent_id,
            pending_since,
            last_activity_at,
            scheduled_for,
            target_sequence,
            attempts,
            updated_at
         )
         VALUES (
            $chatId,
            $agentParticipantId,
            $agentId,
            $now,
            $now,
            $scheduledFor,
            $targetSequence,
            0,
            $now
         )
         ON CONFLICT(chat_id, agent_participant_id) DO UPDATE SET
            agent_id = excluded.agent_id,
            last_activity_at = excluded.last_activity_at,
            scheduled_for = excluded.scheduled_for,
            target_sequence = MAX(memory_extraction_debounces.target_sequence, excluded.target_sequence),
            attempts = 0,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: turn.agentId,
            agentParticipantId: turn.agentParticipantId,
            chatId: turn.chatId,
            now: nowIso,
            scheduledFor,
            targetSequence,
        })
    );

    scheduleTimer(turn.chatId, turn.agentParticipantId, scheduledFor);
    return true;
}

export async function processDueMemoryExtractions(input: { now?: Date } = {}) {
    if (processingPromise) {
        return await processingPromise;
    }
    processingPromise = processDueMemoryExtractionsOnce(input);
    try {
        return await processingPromise;
    } finally {
        processingPromise = null;
    }
}

export function startMemoryExtractionScheduler() {
    if (sweepInterval) {
        return;
    }
    void processDueMemoryExtractions().catch(() => {});
    sweepInterval = setInterval(() => {
        void processDueMemoryExtractions().catch(() => {});
    }, memoryExtractionSweepIntervalMs);
    sweepInterval.unref?.();
}

export function stopMemoryExtractionScheduler() {
    if (sweepInterval) {
        clearInterval(sweepInterval);
        sweepInterval = null;
    }
    for (const timer of scheduledTimers.values()) {
        clearTimeout(timer);
    }
    scheduledTimers.clear();
}

export function setMemoryExtractionWorkerForTesting(worker: MemoryExtractionWorker | null) {
    extractionWorker = worker ?? runAiSdkMemoryExtraction;
}

export function resetMemoryExtractionSchedulerForTesting() {
    stopMemoryExtractionScheduler();
    processingPromise = null;
}

async function processDueMemoryExtractionsOnce(input: { now?: Date } = {}) {
    if (!isMemoryEnabled()) {
        return { completed: 0, failed: 0, skipped: 0 };
    }

    const db = getDb();
    const now = input.now ?? new Date();
    const rows = db
        .prepare(
            `SELECT chat_id, agent_participant_id, agent_id, target_sequence, attempts
             FROM memory_extraction_debounces
             WHERE scheduled_for <= $now
             ORDER BY scheduled_for ASC, chat_id ASC, agent_participant_id ASC`
        )
        .all(namedParams({ now: now.toISOString() })) as DebounceRow[];

    const counts = { completed: 0, failed: 0, skipped: 0 };
    for (const row of rows) {
        try {
            clearScheduledTimer(row.chat_id, row.agent_participant_id);
            const result = await processMemoryExtraction(row, now, db);
            counts[result.status] += 1;
        } catch {
            counts.failed += 1;
            retryOrDropDebounce(row, now, db);
        }
    }

    return counts;
}

/**
 * Backlogs paginate: one worker call per chunk, cursor advance per chunk, loop
 * until the settled target sequence is covered. No message is skipped — a
 * mid-backlog failure resumes from the last completed chunk on retry.
 */
async function processMemoryExtraction(row: DebounceRow, now: Date, db: Database) {
    const cursor = getExtractionCursor(row, db) ?? 0;
    const endSequence = row.target_sequence;

    if (endSequence <= cursor) {
        finishSkippedExtraction(row, {
            endSequence,
            now,
            reason: 'no_extractable_messages',
            startSequence: cursor + 1,
        });
        return deleteDebounce(row, { jobId: null, status: 'skipped' }, db, endSequence);
    }

    let chunkCursor = cursor;
    let completedChunks = 0;
    let lastJobId: string | null = null;

    while (chunkCursor < endSequence) {
        const chunk = nextExtractionChunk(row.chat_id, chunkCursor, endSequence, db);
        if (chunk.messages.length === 0) {
            if (chunkCursor === cursor) {
                finishSkippedExtraction(row, {
                    endSequence,
                    now,
                    reason: 'no_extractable_messages',
                    startSequence: cursor + 1,
                });
            }
            updateExtractionCursor(row, endSequence, now, db);
            break;
        }

        const startSequence = chunkCursor + 1;
        const jobId = createMemoryJob(row, {
            endSequence: chunk.coveredEnd,
            modelCategory: 'fast',
            now,
            startSequence,
            status: 'running',
        });
        lastJobId = jobId;

        try {
            const outcome = await extractionWorker({
                agentId: row.agent_id,
                chatId: row.chat_id,
                jobId,
                messages: chunk.messages,
            });

            if (outcome.observations) {
                const output = await appendEpisodicMemory(row, outcome.observations, {
                    endSequence: chunk.coveredEnd,
                    jobId,
                    now,
                    startSequence,
                });
                completeMemoryJob(jobId, {
                    endSequence: chunk.coveredEnd,
                    fileChanges: [output.fileChange],
                    now,
                    outcome,
                    outputPath: output.relativePath,
                    startSequence,
                });
                completedChunks += 1;
            } else {
                skipMemoryJobAfterRun(jobId, outcome, now);
            }
            updateExtractionCursor(row, chunk.coveredEnd, now, db);
            chunkCursor = chunk.coveredEnd;
        } catch (error) {
            failMemoryJob(jobId, formatError(error), now);
            retryOrDropDebounce(row, now, db);
            return { jobId, status: 'failed' } satisfies ProcessResult;
        }
    }

    if (completedChunks > 0) {
        maybeQueueMemoryDreamForAgent({ agentId: row.agent_id, db, now });
    }
    return deleteDebounce(
        row,
        { jobId: lastJobId, status: completedChunks > 0 ? 'completed' : 'skipped' },
        db,
        endSequence
    );
}

/**
 * A chunk closes at the message limit or character budget, whichever comes
 * first, and always contains at least one message. When nothing bounded the
 * chunk, it covers through the settled target so trailing non-extractable
 * sequences advance the cursor too.
 */
function nextExtractionChunk(chatId: string, cursor: number, endSequence: number, db: Database) {
    const fetched = listExtractableMessages(
        chatId,
        cursor,
        endSequence,
        db,
        memoryExtractionChunkMessageLimit + 1
    );
    const boundedByCount = fetched.length > memoryExtractionChunkMessageLimit;
    const candidates = boundedByCount
        ? fetched.slice(0, memoryExtractionChunkMessageLimit)
        : fetched;

    const messages: MemoryExtractionMessage[] = [];
    let chars = 0;
    for (const message of candidates) {
        if (messages.length > 0 && chars + message.content.length > memoryExtractionChunkChars) {
            break;
        }
        messages.push(message);
        chars += message.content.length;
    }

    const bounded = boundedByCount || messages.length < candidates.length;
    return {
        coveredEnd: bounded ? (messages.at(-1)?.sequence ?? endSequence) : endSequence,
        messages,
    };
}

function finishSkippedExtraction(
    row: DebounceRow,
    input: { endSequence: number; now: Date; reason: string; startSequence: number }
) {
    const jobId = createMemoryJob(row, {
        endSequence: input.endSequence,
        modelCategory: null,
        now: input.now,
        startSequence: input.startSequence,
        status: 'skipped',
    });
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET completed_at = $now,
                 updated_at = $now,
                 metadata_json = $metadataJson
             WHERE id = $jobId`
        )
        .run(
            namedParams({
                jobId,
                metadataJson: JSON.stringify({
                    extractionMode: 'observations',
                    reason: input.reason,
                }),
                now: input.now.toISOString(),
            })
        );
}

async function appendEpisodicMemory(
    row: DebounceRow,
    observations: string,
    input: { endSequence: number; jobId: string; now: Date; startSequence: number }
) {
    const workspaceFolder = getAgentWorkspaceFolder(row.agent_id);
    const dateSlug = input.now.toISOString().slice(0, 10);
    const relativePath = path.join('.memory', 'episodic', `${dateSlug}.md`);
    const filePath = path.join(workspaceFolder, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const previous = await fs.readFile(filePath, 'utf8').catch(() => '');
    const entry = renderEpisodicEntry(row, observations, input);
    const next = previous ? `${previous.replace(/\s*$/u, '\n\n')}${entry}` : entry;
    await fs.writeFile(filePath, next);

    return {
        fileChange: {
            afterHash: sha256(next),
            beforeHash: previous ? sha256(previous) : null,
            path: relativePath,
        },
        relativePath,
    };
}

function renderEpisodicEntry(
    row: DebounceRow,
    observations: string,
    input: { endSequence: number; jobId: string; now: Date; startSequence: number }
) {
    return [
        `## ${input.now.toISOString()} - ${row.chat_id}`,
        '',
        `Source: chat \`${row.chat_id}\`, agent seat \`${row.agent_participant_id}\`, sequences ${input.startSequence}-${input.endSequence}, extraction job \`${input.jobId}\`.`,
        '',
        observations.trim(),
        '',
    ].join('\n');
}

function listExtractableMessages(
    chatId: string,
    cursor: number,
    targetSequence: number,
    db: Database,
    limit: number
) {
    const rows = db
        .prepare(
            `SELECT id, sequence, author_id, role, content, created_at
             FROM chat_messages
             WHERE chat_id = $chatId
               AND sequence > $cursor
               AND sequence <= $targetSequence
               AND deleted_at IS NULL
               AND role IN ('user', 'assistant')
               AND trim(content) != ''
             ORDER BY sequence ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                chatId,
                cursor,
                limit,
                targetSequence,
            })
        ) as Pick<
        MessageRow,
        'author_id' | 'content' | 'created_at' | 'id' | 'role' | 'sequence'
    >[];

    return rows as MemoryExtractionMessage[];
}

function createMemoryJob(
    row: DebounceRow,
    input: {
        endSequence: number;
        modelCategory: 'fast' | null;
        now: Date;
        startSequence: number;
        status: 'running' | 'skipped';
    }
) {
    const now = input.now.toISOString();
    const jobId = `memjob_${crypto.randomUUID().replaceAll('-', '')}`;
    getDb()
        .prepare(
            `INSERT INTO memory_jobs (
                id,
                kind,
                status,
                chat_id,
                agent_id,
                agent_participant_id,
                model_category,
                model_json,
                source_start_sequence,
                source_end_sequence,
                file_changes_json,
                metadata_json,
                created_at,
                updated_at,
                started_at,
                completed_at
             )
             VALUES (
                $jobId,
                'extraction',
                $status,
                $chatId,
                $agentId,
                $agentParticipantId,
                $modelCategory,
                NULL,
                $startSequence,
                $endSequence,
                '[]',
                $metadataJson,
                $now,
                $now,
                $now,
                $completedAt
             )`
        )
        .run(
            namedParams({
                agentId: row.agent_id,
                agentParticipantId: row.agent_participant_id,
                chatId: row.chat_id,
                completedAt: input.status === 'skipped' ? now : null,
                endSequence: input.endSequence,
                jobId,
                metadataJson: JSON.stringify({ extractionMode: 'observations' }),
                modelCategory: input.modelCategory,
                now,
                startSequence: input.startSequence,
                status: input.status,
            })
        );
    return jobId;
}

function completeMemoryJob(
    jobId: string,
    input: {
        endSequence: number;
        fileChanges: unknown[];
        now: Date;
        outcome: MemoryExtractionOutcome;
        outputPath: string;
        startSequence: number;
    }
) {
    const now = input.now.toISOString();
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'completed',
                 model_json = $modelJson,
                 usage_json = $usageJson,
                 metadata_json = $metadataJson,
                 source_start_sequence = $startSequence,
                 source_end_sequence = $endSequence,
                 output_path = $outputPath,
                 file_changes_json = $fileChangesJson,
                 completed_at = $now,
                 updated_at = $now
             WHERE id = $jobId`
        )
        .run(
            namedParams({
                endSequence: input.endSequence,
                fileChangesJson: JSON.stringify(input.fileChanges),
                jobId,
                metadataJson: JSON.stringify({
                    extractionMode: 'observations',
                    observations: input.outcome.observations,
                }),
                modelJson: JSON.stringify(input.outcome.model),
                now,
                outputPath: input.outputPath,
                startSequence: input.startSequence,
                usageJson: JSON.stringify(input.outcome.usage ?? {}),
            })
        );
}

function skipMemoryJobAfterRun(jobId: string, outcome: MemoryExtractionOutcome, now: Date) {
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'skipped',
                 model_json = $modelJson,
                 usage_json = $usageJson,
                 metadata_json = $metadataJson,
                 completed_at = $now,
                 updated_at = $now
             WHERE id = $jobId`
        )
        .run(
            namedParams({
                jobId,
                metadataJson: JSON.stringify({
                    extractionMode: 'observations',
                    reason: 'no_durable_observations',
                }),
                modelJson: JSON.stringify(outcome.model),
                now: now.toISOString(),
                usageJson: JSON.stringify(outcome.usage ?? {}),
            })
        );
}

function failMemoryJob(jobId: string, error: string, now: Date) {
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'failed',
                 error = $error,
                 completed_at = $now,
                 updated_at = $now
             WHERE id = $jobId`
        )
        .run(namedParams({ error, jobId, now: now.toISOString() }));
}

function getChatLastMessageSequence(chatId: string, db: Database) {
    const row = db
        .prepare('SELECT last_message_sequence FROM chats WHERE id = $chatId')
        .get(namedParams({ chatId })) as { last_message_sequence: number } | null;
    return row?.last_message_sequence ?? 0;
}

function getExtractionCursor(row: DebounceRow, db: Database): number | null {
    const cursor = db
        .prepare(
            `SELECT last_extracted_sequence
             FROM memory_extraction_cursors
             WHERE chat_id = $chatId AND agent_participant_id = $agentParticipantId`
        )
        .get(
            namedParams({
                agentParticipantId: row.agent_participant_id,
                chatId: row.chat_id,
            })
        ) as { last_extracted_sequence: number } | null;

    return cursor?.last_extracted_sequence ?? null;
}

function updateExtractionCursor(row: DebounceRow, sequence: number, now: Date, db: Database) {
    const nowIso = now.toISOString();
    db.prepare(
        `INSERT INTO memory_extraction_cursors (
            chat_id,
            agent_participant_id,
            agent_id,
            last_extracted_sequence,
            last_extracted_at,
            created_at,
            updated_at
         )
         VALUES (
            $chatId,
            $agentParticipantId,
            $agentId,
            $sequence,
            $now,
            $now,
            $now
         )
         ON CONFLICT(chat_id, agent_participant_id) DO UPDATE SET
            agent_id = excluded.agent_id,
            last_extracted_sequence = excluded.last_extracted_sequence,
            last_extracted_at = excluded.last_extracted_at,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: row.agent_id,
            agentParticipantId: row.agent_participant_id,
            chatId: row.chat_id,
            now: nowIso,
            sequence,
        })
    );
}

function deleteDebounce(
    row: DebounceRow,
    result: ProcessResult,
    db: Database,
    processedEndSequence: number
) {
    db.prepare(
        `DELETE FROM memory_extraction_debounces
         WHERE chat_id = $chatId
           AND agent_participant_id = $agentParticipantId
           AND target_sequence <= $processedEndSequence`
    ).run(
        namedParams({
            agentParticipantId: row.agent_participant_id,
            chatId: row.chat_id,
            processedEndSequence,
        })
    );
    return result;
}

/**
 * Failed attempts retry on a delay until the cap, then the debounce is dropped.
 * The next completed turn re-schedules the seat and resets the attempt count,
 * so a persistent failure cannot accumulate unbounded failed jobs.
 */
function retryOrDropDebounce(row: DebounceRow, now: Date, db: Database) {
    const attempts = row.attempts + 1;
    if (attempts >= memoryExtractionMaxAttempts) {
        deleteDebounce(row, { jobId: null, status: 'failed' }, db, row.target_sequence);
        return;
    }

    const scheduledFor = addMs(now, memoryExtractionRetryDelayMs).toISOString();
    db.prepare(
        `UPDATE memory_extraction_debounces
         SET scheduled_for = $scheduledFor,
             attempts = $attempts,
             updated_at = $scheduledFor
         WHERE chat_id = $chatId AND agent_participant_id = $agentParticipantId`
    ).run(
        namedParams({
            agentParticipantId: row.agent_participant_id,
            attempts,
            chatId: row.chat_id,
            scheduledFor,
        })
    );
    scheduleTimer(row.chat_id, row.agent_participant_id, scheduledFor);
}

function getAgentWorkspaceFolder(agentId: string) {
    const row = getDb()
        .prepare(
            `SELECT workspace_folder
             FROM agents
             WHERE id = $agentId
             LIMIT 1`
        )
        .get(namedParams({ agentId })) as { workspace_folder: string } | null;
    if (row?.workspace_folder) {
        return row.workspace_folder;
    }

    throw new Error(`Missing workspace folder for agent ${agentId}.`);
}

function scheduleTimer(chatId: string, agentParticipantId: string, scheduledFor: string) {
    const key = debounceKey(chatId, agentParticipantId);
    clearScheduledTimer(chatId, agentParticipantId);
    const delayMs = Math.max(0, new Date(scheduledFor).getTime() - Date.now());
    const timer = setTimeout(() => {
        scheduledTimers.delete(key);
        void processDueMemoryExtractions().catch(() => {});
    }, delayMs);
    timer.unref?.();
    scheduledTimers.set(key, timer);
}

function clearScheduledTimer(chatId: string, agentParticipantId: string) {
    const key = debounceKey(chatId, agentParticipantId);
    const timer = scheduledTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        scheduledTimers.delete(key);
    }
}

function debounceKey(chatId: string, agentParticipantId: string) {
    return `${chatId}:${agentParticipantId}`;
}

function sha256(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function addMs(date: Date, ms: number) {
    return new Date(date.getTime() + ms);
}

function formatError(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Memory extraction failed.';
}
