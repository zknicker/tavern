import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import { startNewAgentSession } from '../tavern/agent-session-store.ts';
import { completeAgentTurn, createAgentTurn } from '../tavern/agent-turn-store.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, createMessage, upsertResponse } from '../tavern/chat-api/index.ts';
import { subscribeToRuntimeEvents } from '../tavern/runtime-events.ts';
import {
    memoryExtractionMaxAttempts,
    processDueMemoryExtractions,
    resetMemoryExtractionSchedulerForTesting,
    scheduleMemoryExtractionForTurn,
    setMemoryExtractionWorkerForTesting,
    startMemoryExtractionScheduler,
} from './extraction.ts';
import {
    type MemoryExtractionWorker,
    memoryExtractionChunkChars,
    memoryExtractionChunkMessageLimit,
} from './extraction-worker.ts';
import { handleMemorySettingsRequest } from './settings.ts';

const echoWorker: MemoryExtractionWorker = async ({ messages }) => ({
    model: { model: 'fast-mini', provider: 'openai' },
    observations: messages
        .map((message) => `- [${message.sequence}] ${message.content}`)
        .join('\n'),
    signals: [],
    usage: { totalTokens: messages.length },
});

describe('Memory extraction', () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-memory-extraction-'));
        ensureRuntimeSchema(initTestDb());
        seedAgentChat(workspace);
        setMemoryExtractionWorkerForTesting(echoWorker);
    });

    afterEach(async () => {
        resetMemoryExtractionSchedulerForTesting();
        setMemoryExtractionWorkerForTesting(null);
        vi.restoreAllMocks();
        closeDb();
        await fs.rm(workspace, { force: true, recursive: true });
    });

    test('schedules extraction after a completed agent turn and writes per-agent episodic memory after the idle window', async () => {
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Please remember the deployment preference.',
            id: 'msg_user_1',
            role: 'user',
        });
        createMessage('cht_memory', {
            author_id: 'agt_primary',
            content: 'I will use the Mac mini release checklist.',
            id: 'msg_agent_1',
            role: 'assistant',
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            outputMessageIds: ['msg_agent_1'],
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });

        const scheduled = scheduleMemoryExtractionForTurn(turn, {
            now: new Date('2026-07-02T20:00:00.000Z'),
        });
        expect(scheduled).toBe(true);
        expect(readDebounce()?.target_sequence).toBe(2);

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:04:59.000Z'),
            })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 0 });

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:05:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        const episodicPath = path.join(workspace, '.memory', 'episodic', '2026-07-02.md');
        await expect(fs.readFile(episodicPath, 'utf8')).resolves.toContain(
            'Please remember the deployment preference.'
        );
        await expect(fs.readFile(episodicPath, 'utf8')).resolves.toContain(
            'I will use the Mac mini release checklist.'
        );
        expect(readCursor()?.last_extracted_sequence).toBe(2);
        expect(readDebounce()).toBeNull();
        expect(readJobs()).toMatchObject([
            {
                agent_id: 'agt_primary',
                kind: 'extraction',
                model_category: 'fast',
                output_path: '.memory/episodic/2026-07-02.md',
                source_end_sequence: 2,
                source_start_sequence: 1,
                status: 'completed',
            },
            {
                agent_id: 'agt_primary',
                kind: 'dream',
                model_category: 'standard',
                status: 'queued',
            },
        ]);
        const completedJob = readJobs()[0] as { metadata_json: string };
        expect(JSON.parse(completedJob.metadata_json)).toMatchObject({
            extractionMode: 'observations',
            observations: expect.stringContaining('deployment preference'),
        });
        expect(readSkillReviewQueue()).toBeNull();
    });

    test('queues skill review when completed extraction emits learning signals', async () => {
        setMemoryExtractionWorkerForTesting(async ({ messages }) => ({
            model: { model: 'fast-mini', provider: 'openai' },
            observations: `- [${messages[0]?.sequence}] Remember signal source.`,
            signals: [
                {
                    detail: 'Use the shorter release checklist.',
                    kind: 'correction',
                },
            ],
            usage: {},
        }));
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Shorter checklist please.',
            id: 'msg_user_1',
            role: 'user',
        });
        let turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await processDueMemoryExtractions({
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        expect(readSkillReviewQueue()).toMatchObject({
            attempts: 0,
            chat_id: 'cht_memory',
            scheduled_for: '2026-07-02T20:01:00.000Z',
            window_end_sequence: 1,
            window_start_sequence: 1,
        });

        getDb()
            .prepare(
                `UPDATE skill_review_queue
                 SET attempts = 2,
                     scheduled_for = '2026-07-02T21:00:00.000Z'
                 WHERE agent_id = 'agt_primary'`
            )
            .run();
        setMemoryExtractionWorkerForTesting(async ({ messages }) => ({
            model: { model: 'fast-mini', provider: 'openai' },
            observations: `- [${messages[0]?.sequence}] Remember technique.`,
            signals: [
                {
                    detail: 'Run runtime tests before lint.',
                    kind: 'technique',
                },
            ],
            usage: {},
        }));
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Runtime tests first.',
            id: 'msg_user_2',
            role: 'user',
        });
        turn = createCompletedTurn({
            now: '2026-07-02T20:02:00.000Z',
            responseId: 'rsp_2',
            runId: 'run_2',
            triggerMessageId: 'msg_user_2',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:02:00.000Z'),
        });

        await processDueMemoryExtractions({
            now: new Date('2026-07-02T20:02:00.000Z'),
        });

        const row = readSkillReviewQueue();
        expect(row).toMatchObject({
            attempts: 0,
            scheduled_for: '2026-07-02T20:03:00.000Z',
            window_end_sequence: 2,
            window_start_sequence: 1,
        });
        expect(JSON.parse(row?.signals_json ?? '[]')).toEqual([
            {
                detail: 'Use the shorter release checklist.',
                kind: 'correction',
            },
            {
                detail: 'Run runtime tests before lint.',
                kind: 'technique',
            },
        ]);
    });

    test('resets the idle debounce and extracts through the newest target sequence', async () => {
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'First preference.',
            id: 'msg_user_1',
            role: 'user',
        });
        let turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Second preference.',
            id: 'msg_user_2',
            role: 'user',
        });
        turn = createCompletedTurn({
            now: '2026-07-02T20:03:00.000Z',
            responseId: 'rsp_2',
            runId: 'run_2',
            triggerMessageId: 'msg_user_2',
        });
        scheduleMemoryExtractionForTurn(turn, {
            now: new Date('2026-07-02T20:03:00.000Z'),
        });

        expect(readDebounce()).toMatchObject({
            scheduled_for: '2026-07-02T20:08:00.000Z',
            target_sequence: 2,
        });
        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:05:00.000Z'),
            })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 0 });
        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:08:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        const body = await fs.readFile(
            path.join(workspace, '.memory', 'episodic', '2026-07-02.md'),
            'utf8'
        );
        expect(body).toContain('First preference.');
        expect(body).toContain('Second preference.');
        expect(readCursor()?.last_extracted_sequence).toBe(2);
    });

    test('does not schedule extraction when Memory is off', async () => {
        await handleMemorySettingsRequest(
            new Request('http://runtime.test/memory/settings', {
                body: JSON.stringify({ enabled: false }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Do not extract this.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });

        expect(scheduleMemoryExtractionForTurn(turn)).toBe(false);
        expect(readDebounce()).toBeNull();
        await expect(processDueMemoryExtractions()).resolves.toEqual({
            completed: 0,
            failed: 0,
            skipped: 0,
        });
    });

    test('startup scheduler sweeps persisted due debounce rows', async () => {
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Persisted extraction after restart.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });
        resetMemoryExtractionSchedulerForTesting();

        startMemoryExtractionScheduler();

        await waitFor(() => readCursor()?.last_extracted_sequence === 1);
        const [episodicFile] = await fs.readdir(path.join(workspace, '.memory', 'episodic'));
        await expect(
            fs.readFile(path.join(workspace, '.memory', 'episodic', episodicFile), 'utf8')
        ).resolves.toContain('Persisted extraction after restart.');
    });

    test('keeps a newer debounce target scheduled during an in-flight extraction', async () => {
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'First message before extraction.',
            id: 'msg_user_1',
            role: 'user',
        });
        const firstTurn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(firstTurn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        const originalWriteFile = fs.writeFile;
        let releaseWrite: () => void = () => {};
        const writeStarted = new Promise<void>((resolve) => {
            vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
                if (String(args[0]).includes(`${path.sep}.memory${path.sep}episodic`)) {
                    resolve();
                    await new Promise<void>((release) => {
                        releaseWrite = release;
                    });
                }
                return await originalWriteFile(...args);
            });
        });

        const processing = processDueMemoryExtractions({
            now: new Date('2026-07-02T20:00:00.000Z'),
        });
        await writeStarted;

        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Second message while extraction writes.',
            id: 'msg_user_2',
            role: 'user',
        });
        const secondTurn = createCompletedTurn({
            now: '2026-07-02T20:01:00.000Z',
            responseId: 'rsp_2',
            runId: 'run_2',
            triggerMessageId: 'msg_user_2',
        });
        scheduleMemoryExtractionForTurn(secondTurn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:01:00.000Z'),
        });

        releaseWrite();
        await expect(processing).resolves.toEqual({
            completed: 1,
            failed: 0,
            skipped: 0,
        });
        vi.restoreAllMocks();
        expect(readCursor()?.last_extracted_sequence).toBe(1);
        expect(readDebounce()?.target_sequence).toBe(2);

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:01:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });
        expect(readCursor()?.last_extracted_sequence).toBe(2);
        expect(readDebounce()).toBeNull();
    });

    test('paginates a large backlog into chunked jobs that cover every message', async () => {
        const messageCount = memoryExtractionChunkMessageLimit + 5;
        for (let index = 1; index <= messageCount; index += 1) {
            createMessage('cht_memory', {
                author_id: 'usr_tavern',
                content: `Backlog message ${index}.`,
                id: `msg_backlog_${index}`,
                role: 'user',
            });
        }
        const batches: number[][] = [];
        setMemoryExtractionWorkerForTesting(async (input) => {
            batches.push(input.messages.map((message) => message.sequence));
            return await echoWorker(input);
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: `msg_backlog_${messageCount}`,
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:00:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        expect(batches).toHaveLength(2);
        expect(batches.flat()).toEqual(
            Array.from({ length: messageCount }, (_, index) => index + 1)
        );
        expect(readCursor()?.last_extracted_sequence).toBe(messageCount);
        expect(readDebounce()).toBeNull();
        expect(
            readJobs().filter((job) => (job as { kind: string }).kind === 'extraction')
        ).toMatchObject([
            {
                source_end_sequence: memoryExtractionChunkMessageLimit,
                source_start_sequence: 1,
                status: 'completed',
            },
            {
                source_end_sequence: messageCount,
                source_start_sequence: memoryExtractionChunkMessageLimit + 1,
                status: 'completed',
            },
        ]);
    });

    test('chunks a backlog by character budget without dropping content', async () => {
        const bigMessageChars = Math.ceil(memoryExtractionChunkChars * 0.4);
        for (let index = 1; index <= 4; index += 1) {
            createMessage('cht_memory', {
                author_id: 'usr_tavern',
                content: `Message ${index}: ${'x'.repeat(bigMessageChars)}`,
                id: `msg_big_${index}`,
                role: 'user',
            });
        }
        const batches: number[][] = [];
        setMemoryExtractionWorkerForTesting(async (input) => {
            batches.push(input.messages.map((message) => message.sequence));
            return {
                model: { model: 'fast-mini', provider: 'openai' },
                observations: `- [${input.messages[0].sequence}] Observed.`,
                signals: [],
                usage: {},
            };
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_big_4',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:00:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        expect(batches).toEqual([
            [1, 2],
            [3, 4],
        ]);
        expect(readCursor()?.last_extracted_sequence).toBe(4);
    });

    test('a mid-backlog failure keeps completed chunks and resumes from the cursor', async () => {
        const messageCount = memoryExtractionChunkMessageLimit + 5;
        for (let index = 1; index <= messageCount; index += 1) {
            createMessage('cht_memory', {
                author_id: 'usr_tavern',
                content: `Backlog message ${index}.`,
                id: `msg_backlog_${index}`,
                role: 'user',
            });
        }
        let calls = 0;
        setMemoryExtractionWorkerForTesting(async (input) => {
            calls += 1;
            if (calls === 2) {
                throw new Error('model unavailable');
            }
            return await echoWorker(input);
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: `msg_backlog_${messageCount}`,
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:00:00.000Z'),
            })
        ).resolves.toEqual({ completed: 0, failed: 1, skipped: 0 });
        expect(readCursor()?.last_extracted_sequence).toBe(memoryExtractionChunkMessageLimit);
        expect(readDebounce()).not.toBeNull();

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:15:00.000Z'),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });
        expect(readCursor()?.last_extracted_sequence).toBe(messageCount);
        expect(readDebounce()).toBeNull();
        expect(
            readJobs()
                .filter((job) => (job as { kind: string }).kind === 'extraction')
                .map((job) => (job as { status: string }).status)
                .sort()
        ).toEqual(['completed', 'completed', 'failed']);
    });

    test('skips the job and advances the cursor when nothing durable was observed', async () => {
        setMemoryExtractionWorkerForTesting(async () => ({
            model: { model: 'fast-mini', provider: 'openai' },
            observations: '',
            signals: [],
            usage: {},
        }));
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Nothing worth keeping here.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await expect(
            processDueMemoryExtractions({
                now: new Date('2026-07-02T20:00:00.000Z'),
            })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 1 });

        expect(readCursor()?.last_extracted_sequence).toBe(1);
        expect(readDebounce()).toBeNull();
        expect(readJobs()).toMatchObject([
            {
                kind: 'extraction',
                metadata_json: JSON.stringify({
                    extractionMode: 'observations',
                    reason: 'no_durable_observations',
                    signals: [],
                }),
                status: 'skipped',
            },
        ]);
        await expect(fs.readdir(path.join(workspace, '.memory', 'episodic'))).rejects.toThrow();
    });

    test('publishes memoryJob.updated runtime events across the job lifecycle', async () => {
        const events: Array<{ jobId?: string; type: string }> = [];
        const unsubscribe = subscribeToRuntimeEvents((event) => {
            if (event.type === 'memoryJob.updated') {
                events.push(event);
            }
        });
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Remember this preference.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        await processDueMemoryExtractions({ now: new Date('2026-07-02T20:00:00.000Z') });
        unsubscribe();

        const extractionJobId = (
            readJobsWithTimes().find((job) => (job as { kind: string }).kind === 'extraction') as {
                id: string;
            }
        ).id;
        // Insert (running), completion, and the queued dream each publish.
        expect(events.length).toBeGreaterThanOrEqual(3);
        expect(events.filter((event) => event.jobId === extractionJobId)).toHaveLength(2);
    });

    test('buckets episodic files and entry headings by the home timezone', async () => {
        setStoredTimezone('America/New_York');
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Evening chat preference.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            now: '2026-07-03T01:30:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-03T01:30:00.000Z'),
        });

        await expect(
            processDueMemoryExtractions({ now: new Date('2026-07-03T01:30:00.000Z') })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        // 01:30Z is still the previous evening in New York.
        const episodicPath = path.join(workspace, '.memory', 'episodic', '2026-07-02.md');
        const body = await fs.readFile(episodicPath, 'utf8');
        expect(body).toContain('## 2026-07-02T21:30:00-04:00 - cht_memory');
        expect(body).toContain('Evening chat preference.');
    });

    test('stamps extraction job start and completion with real clock times outside tests', async () => {
        setMemoryExtractionWorkerForTesting(async ({ messages }) => {
            await new Promise((resolve) => setTimeout(resolve, 15));
            return {
                model: { model: 'fast-mini', provider: 'openai' },
                observations: messages.map((message) => `- [${message.sequence}] noted`).join('\n'),
                signals: [],
                usage: {},
            };
        });
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'Timing check.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, { debounceMs: 0 });

        await processDueMemoryExtractions();

        const job = readJobsWithTimes().find(
            (row) => (row as { kind: string }).kind === 'extraction'
        ) as {
            completed_at: string;
            created_at: string;
            started_at: string;
            status: string;
        };
        expect(job.status).toBe('completed');
        expect(job.started_at).toBe(job.created_at);
        expect(Date.parse(job.completed_at)).toBeGreaterThan(Date.parse(job.started_at));
    });

    test('drops the debounce after the extraction retry cap instead of retrying forever', async () => {
        setMemoryExtractionWorkerForTesting(async () => {
            throw new Error('model unavailable');
        });
        createMessage('cht_memory', {
            author_id: 'usr_tavern',
            content: 'This extraction will fail.',
            id: 'msg_user_1',
            role: 'user',
        });
        const turn = createCompletedTurn({
            now: '2026-07-02T20:00:00.000Z',
            responseId: 'rsp_1',
            runId: 'run_1',
            triggerMessageId: 'msg_user_1',
        });
        scheduleMemoryExtractionForTurn(turn, {
            debounceMs: 0,
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        let now = new Date('2026-07-02T20:00:00.000Z');
        for (let attempt = 1; attempt <= memoryExtractionMaxAttempts; attempt += 1) {
            await expect(processDueMemoryExtractions({ now })).resolves.toEqual({
                completed: 0,
                failed: 1,
                skipped: 0,
            });
            now = new Date(now.getTime() + 15 * 60 * 1000);
        }

        expect(readDebounce()).toBeNull();
        expect(
            readJobs().filter((job) => (job as { status: string }).status === 'failed')
        ).toHaveLength(memoryExtractionMaxAttempts);
        await expect(processDueMemoryExtractions({ now })).resolves.toEqual({
            completed: 0,
            failed: 0,
            skipped: 0,
        });
        expect(readCursor()).toBeNull();
    });
});

function setStoredTimezone(timezone: string) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ('runtime:timezone', $value, '2026-07-02T19:00:00.000Z')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(namedParams({ value: JSON.stringify({ timezone }) }));
}

function seedAgentChat(workspace: string) {
    setStoredTimezone('UTC');
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: workspace,
        },
        syncedAt: '2026-07-02T19:00:00.000Z',
    });
    createChat({
        id: 'cht_memory',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: 'Memory',
    });
    startNewAgentSession({
        agentId: 'agt_primary',
        effectiveModel: { model: 'gpt-4.1', provider: 'openai' },
        now: '2026-07-02T19:00:00.000Z',
    });
}

function createCompletedTurn(input: {
    now?: string;
    outputMessageIds?: string[];
    responseId: string;
    runId: string;
    triggerMessageId: string;
}) {
    const sessionId = readCurrentSessionId();
    upsertResponse('cht_memory', {
        id: input.responseId,
        participant_id: 'agt_primary',
        request_message_id: input.triggerMessageId,
        status: 'running',
    });
    createAgentTurn({
        agentId: 'agt_primary',
        agentParticipantId: 'agt_primary',
        agentSessionId: sessionId,
        chatId: 'cht_memory',
        id: input.runId,
        responseId: input.responseId,
        triggerMessageId: input.triggerMessageId,
    });
    return completeAgentTurn({
        activityIds: [],
        id: input.runId,
        now: input.now,
        outputMessageIds: input.outputMessageIds ?? [],
    });
}

function readCurrentSessionId() {
    const row = getDb()
        .prepare(
            `SELECT id
             FROM agent_sessions
             WHERE agent_id = 'agt_primary' AND status = 'active'
             ORDER BY generation DESC
             LIMIT 1`
        )
        .get() as { id: string } | null;
    if (!row?.id) {
        throw new Error('Missing current test agent session.');
    }
    return row.id;
}

function readDebounce() {
    return getDb().prepare('SELECT * FROM memory_extraction_debounces LIMIT 1').get() as null | {
        scheduled_for: string;
        target_sequence: number;
    };
}

function readCursor() {
    return getDb().prepare('SELECT * FROM memory_extraction_cursors LIMIT 1').get() as null | {
        last_extracted_sequence: number;
    };
}

function readJobs() {
    return getDb()
        .prepare(
            `SELECT agent_id, kind, metadata_json, model_category, output_path, source_end_sequence,
                    source_start_sequence, status
             FROM memory_jobs
             ORDER BY created_at ASC`
        )
        .all();
}

function readJobsWithTimes() {
    return getDb()
        .prepare(
            `SELECT id, kind, status, created_at, started_at, completed_at
             FROM memory_jobs
             ORDER BY created_at ASC`
        )
        .all();
}

function readSkillReviewQueue() {
    return getDb().prepare('SELECT * FROM skill_review_queue LIMIT 1').get() as null | {
        attempts: number;
        chat_id: string;
        scheduled_for: string;
        signals_json: string;
        window_end_sequence: number;
        window_start_sequence: number;
    };
}

async function waitFor(assertion: () => boolean, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (assertion()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(assertion()).toBe(true);
}
