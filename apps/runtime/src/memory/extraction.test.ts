import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { startNewAgentSession } from '../tavern/agent-session-store.ts';
import { completeAgentTurn, createAgentTurn } from '../tavern/agent-turn-store.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, createMessage, upsertResponse } from '../tavern/chat-api/index.ts';
import {
    processDueMemoryExtractions,
    resetMemoryExtractionSchedulerForTesting,
    scheduleMemoryExtractionForTurn,
    startMemoryExtractionScheduler,
} from './extraction.ts';
import { handleMemorySettingsRequest } from './settings.ts';

describe('Memory extraction', () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-memory-extraction-'));
        ensureRuntimeSchema(initTestDb());
        seedAgentChat(workspace);
    });

    afterEach(async () => {
        resetMemoryExtractionSchedulerForTesting();
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
            processDueMemoryExtractions({ now: new Date('2026-07-02T20:04:59.000Z') })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 0 });

        await expect(
            processDueMemoryExtractions({ now: new Date('2026-07-02T20:05:00.000Z') })
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
                metadata_json: '{"extractionMode":"transcript-excerpt"}',
                model_category: null,
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
            processDueMemoryExtractions({ now: new Date('2026-07-02T20:05:00.000Z') })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 0 });
        await expect(
            processDueMemoryExtractions({ now: new Date('2026-07-02T20:08:00.000Z') })
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
        await expect(processing).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });
        vi.restoreAllMocks();
        expect(readCursor()?.last_extracted_sequence).toBe(1);
        expect(readDebounce()?.target_sequence).toBe(2);

        await expect(
            processDueMemoryExtractions({ now: new Date('2026-07-02T20:01:00.000Z') })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });
        expect(readCursor()?.last_extracted_sequence).toBe(2);
        expect(readDebounce()).toBeNull();
    });
});

function seedAgentChat(workspace: string) {
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
        agentParticipantId: 'agt_primary',
        chatId: 'cht_memory',
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
            `SELECT current_agent_session_id
             FROM chat_participants
             WHERE chat_id = 'cht_memory' AND id = 'agt_primary'`
        )
        .get() as { current_agent_session_id: string } | null;
    if (!row?.current_agent_session_id) {
        throw new Error('Missing current test agent session.');
    }
    return row.current_agent_session_id;
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
