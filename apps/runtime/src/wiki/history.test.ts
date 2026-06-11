import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { listWikiHealthHistory, recordWikiHealthSamples } from './history';

describe('wiki health history', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-history-'));
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

    test('records on scan change and escalation change, dedupes otherwise', async () => {
        await writeScan('s1', 80, 70);
        await writeEscalation('verify-a.md');

        const first = new Date('2026-06-10T06:00:00.000Z');
        expect(await recordWikiHealthSamples(getDb(), first)).toBe(1);

        const soonAfter = new Date('2026-06-10T07:00:00.000Z');
        expect(await recordWikiHealthSamples(getDb(), soonAfter)).toBe(0);

        await writeEscalation('verify-b.md');
        expect(await recordWikiHealthSamples(getDb(), new Date('2026-06-10T08:00:00.000Z'))).toBe(
            1
        );

        await writeScan('s2', 90, 84);
        expect(await recordWikiHealthSamples(getDb(), new Date('2026-06-10T09:00:00.000Z'))).toBe(
            1
        );

        const history = listWikiHealthHistory(getDb());
        expect(history).toHaveLength(3);
        expect(history.at(-1)).toMatchObject({
            avgQuality: 84,
            avgStaleness: 90,
            escalationsOpen: 2,
            scanId: 's2',
            topic: 'project-notes',
        });
    });

    test('records a daily heartbeat without changes', async () => {
        await writeScan('s1', 80, 70);
        await recordWikiHealthSamples(getDb(), new Date('2026-06-10T06:00:00.000Z'));

        expect(await recordWikiHealthSamples(getDb(), new Date('2026-06-11T07:00:00.000Z'))).toBe(
            1
        );
        expect(listWikiHealthHistory(getDb())).toHaveLength(2);
    });

    async function writeScan(scanId: string, avgStaleness: number, avgQuality: number) {
        await writeTopicFile(
            '.librarian/scan-results.json',
            JSON.stringify({
                articles: {},
                scan_id: scanId,
                summary: {
                    articles_scanned: 3,
                    avg_quality: avgQuality,
                    avg_staleness: avgStaleness,
                    low_quality_count: 0,
                    stale_count: 0,
                },
                threshold: 70,
            })
        );
    }

    async function writeEscalation(file: string) {
        await writeTopicFile(
            `todos/${file}`,
            ['---', 'title: Needs a call', 'status: proposed', 'owner: user', '---'].join('\n')
        );
    }

    async function writeTopicFile(relativePath: string, content: string) {
        const filePath = path.join(hubPath, 'topics', 'project-notes', relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content);
    }
});
