import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import type { AgentTurn } from '../tavern/agent-turn-store.ts';
import type { MessageRow } from '../tavern/chat-api/types.ts';
import { maybeQueueMemoryDreamForAgent } from './dreaming.ts';
import { isMemoryEnabled } from './settings.ts';

export const memoryExtractionIdleDebounceMs = 5 * 60 * 1000;
export const memoryExtractionRetryDelayMs = 15 * 60 * 1000;
export const memoryExtractionSweepIntervalMs = 60 * 1000;

interface DebounceRow {
    agent_id: string;
    agent_participant_id: string;
    chat_id: string;
    target_sequence: number;
}

interface ExtractionMessage {
    author_id: string;
    content: string;
    created_at: string;
    id: string;
    role: 'assistant' | 'user';
    sequence: number;
}

interface ProcessResult {
    jobId: string | null;
    status: 'completed' | 'failed' | 'skipped';
}

const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
let sweepInterval: ReturnType<typeof setInterval> | null = null;
let processingPromise: Promise<{ completed: number; failed: number; skipped: number }> | null =
    null;

export function scheduleMemoryExtractionForTurn(
    turn: AgentTurn,
    input: { debounceMs?: number; now?: Date } = {}
) {
    if (turn.status !== 'completed' || !isMemoryEnabled()) {
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
            $now
         )
         ON CONFLICT(chat_id, agent_participant_id) DO UPDATE SET
            agent_id = excluded.agent_id,
            last_activity_at = excluded.last_activity_at,
            scheduled_for = excluded.scheduled_for,
            target_sequence = MAX(memory_extraction_debounces.target_sequence, excluded.target_sequence),
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

async function processDueMemoryExtractionsOnce(input: { now?: Date } = {}) {
    if (!isMemoryEnabled()) {
        return { completed: 0, failed: 0, skipped: 0 };
    }

    const db = getDb();
    const now = input.now ?? new Date();
    const rows = db
        .prepare(
            `SELECT chat_id, agent_participant_id, agent_id, target_sequence
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
            rescheduleDebounce(row, addMs(now, memoryExtractionRetryDelayMs), db);
        }
    }

    return counts;
}

export function resetMemoryExtractionSchedulerForTesting() {
    stopMemoryExtractionScheduler();
    processingPromise = null;
}

async function processMemoryExtraction(row: DebounceRow, now: Date, db: Database) {
    const cursor = getExtractionCursor(row, db);
    const startSequence = cursor + 1;
    const endSequence = row.target_sequence;

    if (endSequence <= cursor) {
        await finishSkippedExtraction(row, startSequence, endSequence, now, db);
        return deleteDebounce(row, { jobId: null, status: 'skipped' }, db, endSequence);
    }

    const messages = listExtractableMessages(row.chat_id, cursor, endSequence, db);
    if (messages.length === 0) {
        await finishSkippedExtraction(row, startSequence, endSequence, now, db);
        updateExtractionCursor(row, endSequence, now, db);
        return deleteDebounce(row, { jobId: null, status: 'skipped' }, db, endSequence);
    }

    const jobId = createMemoryJob(row, {
        endSequence,
        now,
        startSequence,
        status: 'running',
    });

    try {
        const output = await appendEpisodicMemory(row, messages, { jobId, now });
        completeMemoryJob(jobId, {
            endSequence,
            fileChanges: [output.fileChange],
            now,
            outputPath: output.relativePath,
            startSequence,
        });
        updateExtractionCursor(row, endSequence, now, db);
        maybeQueueMemoryDreamForAgent({ agentId: row.agent_id, db, now });
        return deleteDebounce(row, { jobId, status: 'completed' }, db, endSequence);
    } catch (error) {
        failMemoryJob(jobId, formatError(error), now);
        rescheduleDebounce(row, addMs(now, memoryExtractionRetryDelayMs), db);
        return { jobId, status: 'failed' } satisfies ProcessResult;
    }
}

async function finishSkippedExtraction(
    row: DebounceRow,
    startSequence: number,
    endSequence: number,
    now: Date,
    db: Database
) {
    const jobId = createMemoryJob(row, {
        endSequence,
        now,
        startSequence,
        status: 'skipped',
    });
    db.prepare(
        `UPDATE memory_jobs
         SET completed_at = $now,
             updated_at = $now,
             metadata_json = $metadataJson
         WHERE id = $jobId`
    ).run(
        namedParams({
            jobId,
            metadataJson: JSON.stringify({ reason: 'no_extractable_messages' }),
            now: now.toISOString(),
        })
    );
}

async function appendEpisodicMemory(
    row: DebounceRow,
    messages: ExtractionMessage[],
    input: { jobId: string; now: Date }
) {
    const workspaceFolder = getAgentWorkspaceFolder(row.agent_id);
    const dateSlug = input.now.toISOString().slice(0, 10);
    const relativePath = path.join('.memory', 'episodic', `${dateSlug}.md`);
    const filePath = path.join(workspaceFolder, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const previous = await fs.readFile(filePath, 'utf8').catch(() => '');
    const entry = renderEpisodicEntry(row, messages, input);
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
    messages: ExtractionMessage[],
    input: { jobId: string; now: Date }
) {
    const first = messages[0];
    const last = messages.at(-1);
    const lines = [
        `## ${input.now.toISOString()} - ${row.chat_id}`,
        '',
        `Source: chat \`${row.chat_id}\`, agent seat \`${row.agent_participant_id}\`, sequences ${first.sequence}-${last?.sequence ?? first.sequence}, extraction job \`${input.jobId}\`.`,
        '',
    ];

    for (const message of messages) {
        lines.push(
            `- [${message.sequence}] ${message.role} (${message.author_id}, ${message.created_at}): ${formatExcerpt(message.content)}`
        );
    }

    lines.push('');
    return lines.join('\n');
}

function listExtractableMessages(
    chatId: string,
    cursor: number,
    targetSequence: number,
    db: Database
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
             ORDER BY sequence ASC`
        )
        .all(
            namedParams({
                chatId,
                cursor,
                targetSequence,
            })
        ) as Pick<
        MessageRow,
        'author_id' | 'content' | 'created_at' | 'id' | 'role' | 'sequence'
    >[];

    return rows as ExtractionMessage[];
}

function createMemoryJob(
    row: DebounceRow,
    input: {
        endSequence: number;
        now: Date;
        startSequence: number;
        status: 'running' | 'skipped';
    }
) {
    const now = input.now.toISOString();
    const jobId = `memjob_${crypto.randomUUID().replaceAll('-', '')}`;
    dbInsertMemoryJob({
        agentId: row.agent_id,
        agentParticipantId: row.agent_participant_id,
        chatId: row.chat_id,
        endSequence: input.endSequence,
        jobId,
        now,
        startSequence: input.startSequence,
        status: input.status,
    });
    return jobId;
}

function dbInsertMemoryJob(input: {
    agentId: string;
    agentParticipantId: string;
    chatId: string;
    endSequence: number;
    jobId: string;
    now: string;
    startSequence: number;
    status: 'running' | 'skipped';
}) {
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
                NULL,
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
                agentId: input.agentId,
                agentParticipantId: input.agentParticipantId,
                chatId: input.chatId,
                completedAt: input.status === 'skipped' ? input.now : null,
                endSequence: input.endSequence,
                jobId: input.jobId,
                metadataJson: JSON.stringify({ extractionMode: 'transcript-excerpt' }),
                now: input.now,
                startSequence: input.startSequence,
                status: input.status,
            })
        );
}

function completeMemoryJob(
    jobId: string,
    input: {
        endSequence: number;
        fileChanges: unknown[];
        now: Date;
        outputPath: string;
        startSequence: number;
    }
) {
    const now = input.now.toISOString();
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'completed',
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
                now,
                outputPath: input.outputPath,
                startSequence: input.startSequence,
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

function getExtractionCursor(row: DebounceRow, db: Database) {
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

    return cursor?.last_extracted_sequence ?? 0;
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

function rescheduleDebounce(row: DebounceRow, nextScheduledFor: Date, db: Database) {
    const scheduledFor = nextScheduledFor.toISOString();
    db.prepare(
        `UPDATE memory_extraction_debounces
         SET scheduled_for = $scheduledFor,
             updated_at = $scheduledFor
         WHERE chat_id = $chatId AND agent_participant_id = $agentParticipantId`
    ).run(
        namedParams({
            agentParticipantId: row.agent_participant_id,
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

function formatExcerpt(content: string) {
    const normalized = content.replace(/\s+/gu, ' ').trim();
    const maxLength = 800;
    const value =
        normalized.length > maxLength
            ? `${normalized.slice(0, maxLength - 1).trimEnd()}...`
            : normalized;
    return JSON.stringify(value);
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
