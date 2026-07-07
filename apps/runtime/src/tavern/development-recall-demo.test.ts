import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { getAgentTurnPromptEvidence } from './agent-turn-store.ts';
import { seedDevelopmentChatDemos } from './development-chat-demos.ts';

describe('development recall demo seeding', () => {
    let memoryRoot: string;
    const originalMemoryPath = process.env.TAVERN_MEMORY_PATH;

    beforeEach(async () => {
        memoryRoot = await mkdtemp(path.join(tmpdir(), 'tavern-recall-demo-'));
        process.env.TAVERN_MEMORY_PATH = memoryRoot;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        if (originalMemoryPath === undefined) {
            process.env.TAVERN_MEMORY_PATH = undefined;
        } else {
            process.env.TAVERN_MEMORY_PATH = originalMemoryPath;
        }
        closeDb();
        await rm(memoryRoot, { force: true, recursive: true });
    });

    it('seeds demo memory pages and settled turns with prompt evidence', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(existsSync(path.join(memoryRoot, 'projects/demo-dashboard.md'))).toBe(true);
        expect(existsSync(path.join(memoryRoot, 'people/demo-user.md'))).toBe(true);

        const turns = getDb()
            .prepare(
                `SELECT id, status FROM agent_turns
                 WHERE chat_id = $chatId
                 ORDER BY created_at DESC`
            )
            .all({ $chatId: developmentChatDemoId }) as Array<{ id: string; status: string }>;
        expect(turns.length).toBeGreaterThan(0);
        expect(turns.every((turn) => turn.status === 'completed')).toBe(true);

        const evidence = getAgentTurnPromptEvidence(turns[0]?.id ?? '');
        expect(evidence?.recall.map((hit) => hit.path)).toEqual([
            'projects/demo-dashboard.md',
            'people/demo-user.md',
        ]);
        expect(evidence?.prompt).toContain('Recalled Memory pages');
    });

    it('reseeds idempotently', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        const count = getDb()
            .prepare('SELECT COUNT(*) AS n FROM agent_turns WHERE chat_id = $chatId')
            .get({ $chatId: developmentChatDemoId }) as { n: number };
        expect(count.n).toBeLessThanOrEqual(2);
    });
});
