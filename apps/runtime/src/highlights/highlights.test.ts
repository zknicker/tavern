import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeCronRun } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { generateTavernHighlights, listTavernHighlights } from './highlights';

describe('Tavern highlights', () => {
    let db: Database;
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        db = initTestDb();
        ensureRuntimeSchema(db);
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-highlights-wiki-'));
        process.env.TAVERN_WIKI_HUB_PATH = hubPath;
    });

    afterEach(async () => {
        closeDb();
        if (previousHubPath === undefined) {
            Reflect.deleteProperty(process.env, 'TAVERN_WIKI_HUB_PATH');
        } else {
            process.env.TAVERN_WIKI_HUB_PATH = previousHubPath;
        }
        await fs.rm(hubPath, { force: true, recursive: true });
    });

    test('persists one current highlight per applicable category', async () => {
        const now = new Date('2026-06-03T18:25:00.000Z');
        seedRecentActivity(db);

        const result = await generateTavernHighlights({
            cronRuns: [cronRun()],
            db,
            now,
        });

        expect(result.freshness).toMatchObject({
            generatedAt: now.toISOString(),
            staleReason: null,
            status: 'fresh',
        });
        expect(result.highlights.map((highlight) => highlight.category).sort()).toEqual([
            'quest_finished',
            'scheduled_run',
            'tool_volume',
            'trouble',
        ]);
        expect(
            result.highlights.find((highlight) => highlight.category === 'tool_volume')
        ).toMatchObject({
            receipt: 'Blippy completed 2 tool calls in the past 24 hours.',
        });

        await generateTavernHighlights({
            cronRuns: [cronRun()],
            db,
            now: new Date('2026-06-03T18:45:00.000Z'),
        });

        expect(listTavernHighlights({ db, now }).highlights).toHaveLength(4);
    });

    test('marks runtime highlights stale when the generator has not refreshed', async () => {
        await generateTavernHighlights({
            cronRuns: [cronRun()],
            db,
            now: new Date('2026-06-03T18:25:00.000Z'),
        });

        expect(
            listTavernHighlights({
                db,
                now: new Date('2026-06-03T22:00:00.000Z'),
            }).freshness
        ).toMatchObject({
            staleReason: 'Highlights have not regenerated in the past 3 hours.',
            status: 'stale',
        });
    });

    test('surfaces user-owned wiki follow-ups as a highlight', async () => {
        const now = new Date('2026-06-03T18:25:00.000Z');
        await writeInventoryRecord(
            'project-notes',
            'verify-claim.md',
            ['---', 'title: Verify launch claim', 'status: proposed', 'owner: user', '---'].join(
                '\n'
            )
        );
        await writeInventoryRecord(
            'project-notes',
            'agent-task.md',
            ['---', 'title: Profile candidate', 'status: proposed', '---'].join('\n')
        );

        const result = await generateTavernHighlights({ cronRuns: [], db, now });
        const highlight = result.highlights.find(
            (candidate) => candidate.category === 'wiki_attention'
        );

        expect(highlight).toMatchObject({
            metric: { count: 1, topics: ['project-notes'] },
            receipt: '1 wiki follow-up in 1 topic waiting on your call in Cortex.',
        });
    });

    async function writeInventoryRecord(topic: string, file: string, content: string) {
        const filePath = path.join(hubPath, 'topics', topic, 'inventory', file);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content);
    }

    test('records a fresh empty generation when no category applies', async () => {
        const now = new Date('2026-06-03T18:25:00.000Z');

        const result = await generateTavernHighlights({
            cronRuns: [],
            db,
            now,
        });

        expect(result).toMatchObject({
            freshness: {
                generatedAt: now.toISOString(),
                staleReason: null,
                status: 'empty',
            },
            highlights: [],
        });
    });
});

function seedRecentActivity(db: Database) {
    const base = {
        agentId: 'agt_blippy',
        chatId: 'cht_highlights',
        now: '2026-06-03T18:20:00.000Z',
    };

    db.prepare(
        `INSERT INTO agents (
            id,
            name,
            workspace_folder,
            raw_json,
            last_synced_at,
            created_at,
            updated_at
        )
        VALUES (
            $agentId,
            'Blippy',
            '/tmp/blippy',
            '{}',
            $now,
            $now,
            $now
        )`
    ).run(namedParams(base));

    db.prepare(
        `INSERT INTO chats (id, title, created_at, updated_at)
         VALUES ($chatId, 'Highlight Chat', $now, $now)`
    ).run(namedParams(base));

    db.prepare(
        `INSERT INTO chat_responses (
            id,
            chat_id,
            participant_id,
            status,
            summary,
            created_at,
            updated_at,
            completed_at
        )
        VALUES (
            'rsp_success',
            $chatId,
            $agentId,
            'completed',
            'Finished the quest.',
            '2026-06-03T18:00:00.000Z',
            $now,
            $now
        )`
    ).run(namedParams(base));

    db.prepare(
        `INSERT INTO chat_responses (
            id,
            chat_id,
            participant_id,
            status,
            summary,
            created_at,
            updated_at,
            completed_at
        )
        VALUES (
            'rsp_failed',
            $chatId,
            $agentId,
            'failed',
            'A spell misfired.',
            '2026-06-03T18:05:00.000Z',
            '2026-06-03T18:10:00.000Z',
            '2026-06-03T18:10:00.000Z'
        )`
    ).run(namedParams(base));

    for (const sequence of [1, 2]) {
        db.prepare(
            `INSERT INTO chat_response_activity (
                id,
                response_id,
                chat_id,
                sequence,
                kind,
                status,
                title,
                started_at,
                updated_at,
                completed_at
            )
            VALUES (
                $id,
                'rsp_success',
                $chatId,
                $sequence,
                'tool_call',
                'completed',
                'Tool call',
                '2026-06-03T18:05:00.000Z',
                $now,
                $now
            )`
        ).run(
            namedParams({
                ...base,
                id: `act_tool_${sequence}`,
                sequence,
            })
        );
    }
}

function cronRun(): AgentRuntimeCronRun {
    return {
        deliveryError: null,
        deliveryStatus: null,
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt: '2026-06-03T18:18:00.000Z',
        id: 'run_highlights',
        jobId: 'cron_highlights',
        scheduledFor: '2026-06-03T18:15:00.000Z',
        sessionId: null,
        sessionKey: null,
        startedAt: '2026-06-03T18:15:00.000Z',
        status: 'success',
        summary: 'Done',
        trigger: 'schedule',
    };
}
