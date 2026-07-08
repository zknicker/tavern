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
    let wikiRoot: string;
    const originalWikiPath = process.env.TAVERN_WIKI_PATH;

    beforeEach(async () => {
        wikiRoot = await mkdtemp(path.join(tmpdir(), 'tavern-recall-demo-'));
        process.env.TAVERN_WIKI_PATH = wikiRoot;
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        if (originalWikiPath === undefined) {
            process.env.TAVERN_WIKI_PATH = undefined;
        } else {
            process.env.TAVERN_WIKI_PATH = originalWikiPath;
        }
        closeDb();
        await rm(wikiRoot, { force: true, recursive: true });
    });

    it('seeds demo Wiki pages and settled turns with prompt evidence', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        expect(existsSync(path.join(wikiRoot, 'projects/demo-dashboard.md'))).toBe(true);
        expect(existsSync(path.join(wikiRoot, 'people/demo-user.md'))).toBe(true);

        const turns = getDb()
            .prepare(
                `SELECT id, status FROM agent_turns
                 WHERE chat_id = $chatId AND metadata_json LIKE '%promptEvidence%'
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
        expect(evidence?.prompt).toContain('Recalled Wiki:');
    });

    it('reseeds idempotently', () => {
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });
        seedDevelopmentChatDemos({ db: getDb(), enabled: true });

        const count = getDb()
            .prepare(
                `SELECT COUNT(*) AS n FROM agent_turns
                 WHERE chat_id = $chatId AND metadata_json LIKE '%promptEvidence%'`
            )
            .get({ $chatId: developmentChatDemoId }) as { n: number };
        expect(count.n).toBeLessThanOrEqual(2);
    });
});
