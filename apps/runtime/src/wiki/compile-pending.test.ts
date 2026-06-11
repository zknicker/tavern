import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeCronList } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    type CompileTriggerClient,
    isCompileTriggerDue,
    listPendingCompileTopics,
    runWikiCompileTrigger,
} from './compile-pending';

const nowMs = Date.parse('2026-06-11T12:00:00Z');
const hourMs = 60 * 60 * 1000;

describe('wiki compile trigger', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-compile-pending-'));
        process.env.TAVERN_WIKI_HUB_PATH = hubPath;
    });

    afterEach(async () => {
        if (previousHubPath === undefined) {
            Reflect.deleteProperty(process.env, 'TAVERN_WIKI_HUB_PATH');
        } else {
            process.env.TAVERN_WIKI_HUB_PATH = previousHubPath;
        }
        await fs.rm(hubPath, { force: true, recursive: true });
    });

    test('counts only ingest entries after the last compile entry', async () => {
        await writeRawSource('coffee', 'raw/articles/2026-06-09-old.md', nowMs - 48 * hourMs);
        await writeRawSource('coffee', 'raw/articles/2026-06-11-one.md', nowMs - 3 * hourMs);
        await writeRawSource('coffee', 'raw/articles/2026-06-11-two.md', nowMs - 2 * hourMs);
        await writeTopicFile(
            'coffee',
            'log.md',
            [
                '# Activity Log',
                '',
                '## [2026-06-09] ingest | Old source (raw/articles/2026-06-09-old.md)',
                '## [2026-06-10] compile | 1 source compiled',
                '## [2026-06-11] ingest | One (raw/articles/2026-06-11-one.md)',
                '## [2026-06-11] ingest | Two (raw/articles/2026-06-11-two.md)',
                '## [2026-06-11] query | unrelated entry',
            ].join('\n')
        );

        const pending = await listPendingCompileTopics();

        expect(pending).toEqual([
            {
                newestPendingAtMs: nowMs - 2 * hourMs,
                pendingCount: 2,
                topic: 'coffee',
            },
        ]);
    });

    test('research entries reset pending like compile entries', async () => {
        await writeTopicFile(
            'coffee',
            'log.md',
            [
                '## [2026-06-10] ingest | One (raw/articles/2026-06-10-one.md)',
                '## [2026-06-10] research | "espresso" → 3 sources ingested, 2 articles compiled',
            ].join('\n')
        );

        expect(await listPendingCompileTopics()).toEqual([]);
    });

    test('falls back to the log entry date when the raw file is missing', async () => {
        await writeTopicFile(
            'coffee',
            'log.md',
            '## [2026-06-09] ingest | Gone (raw/articles/2026-06-09-gone.md)'
        );

        const pending = await listPendingCompileTopics();

        expect(pending).toEqual([
            {
                newestPendingAtMs: Date.parse('2026-06-09T00:00:00Z'),
                pendingCount: 1,
                topic: 'coffee',
            },
        ]);
    });

    test('topics without a log have nothing pending', async () => {
        await writeTopicFile('coffee', 'wiki/alpha.md', '# Alpha');

        expect(await listPendingCompileTopics()).toEqual([]);
    });

    test('trigger decision: count threshold with a settle window', () => {
        const base = { newestPendingAtMs: nowMs - hourMs };

        // A batch still settling never triggers, regardless of count.
        expect(
            isCompileTriggerDue(
                {
                    newestPendingAtMs: nowMs - 5 * 60 * 1000,
                    pendingCount: 9,
                    topic: 'coffee',
                },
                nowMs
            )
        ).toBe(false);
        expect(isCompileTriggerDue({ ...base, pendingCount: 5, topic: 'coffee' }, nowMs)).toBe(
            true
        );
        // Small ingests wait for the daily upkeep run.
        expect(isCompileTriggerDue({ ...base, pendingCount: 4, topic: 'coffee' }, nowMs)).toBe(
            false
        );
    });

    test('triggers the managed upkeep cron when a topic is due', async () => {
        await seedDueTopic();
        const client = fakeClient({ enabled: true, lastRunAtMs: nowMs - 2 * hourMs });

        const outcome = await runWikiCompileTrigger(client, nowMs);

        expect(outcome).toEqual({ kind: 'triggered', topics: ['coffee'] });
        expect(client.triggered).toEqual(['wiki-upkeep']);
    });

    test('skips when upkeep ran inside the cooldown window', async () => {
        await seedDueTopic();
        const client = fakeClient({ enabled: true, lastRunAtMs: nowMs - 10 * 60 * 1000 });

        const outcome = await runWikiCompileTrigger(client, nowMs);

        expect(outcome).toEqual({ kind: 'skipped', reason: 'cooldown', topics: ['coffee'] });
        expect(client.triggered).toEqual([]);
    });

    test('skips when the user paused the upkeep cron', async () => {
        await seedDueTopic();
        const client = fakeClient({ enabled: false, lastRunAtMs: nowMs - 2 * hourMs });

        const outcome = await runWikiCompileTrigger(client, nowMs);

        expect(outcome).toEqual({ kind: 'skipped', reason: 'cron-paused', topics: ['coffee'] });
        expect(client.triggered).toEqual([]);
    });

    test('skips when the managed upkeep cron does not exist yet', async () => {
        await seedDueTopic();
        const client = fakeClient(null);

        const outcome = await runWikiCompileTrigger(client, nowMs);

        expect(outcome).toEqual({ kind: 'skipped', reason: 'cron-missing', topics: ['coffee'] });
        expect(client.triggered).toEqual([]);
    });

    test('idles without consulting the gateway when nothing is pending', async () => {
        await writeTopicFile('coffee', 'wiki/alpha.md', '# Alpha');
        const client = fakeClient(null);

        expect(await runWikiCompileTrigger(client, nowMs)).toEqual({ kind: 'idle' });
        expect(client.listed).toBe(false);
    });

    async function writeTopicFile(topic: string, relativePath: string, content: string) {
        const filePath = path.join(hubPath, 'topics', topic, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `${content}\n`);
        return filePath;
    }

    async function writeRawSource(topic: string, relativePath: string, mtimeMs: number) {
        const filePath = await writeTopicFile(topic, relativePath, '# Source');
        await fs.utimes(filePath, new Date(mtimeMs), new Date(mtimeMs));
    }

    async function seedDueTopic() {
        const lines: string[] = [];
        for (const index of [1, 2, 3, 4, 5]) {
            const rawPath = `raw/articles/2026-06-11-source-${index}.md`;
            await writeRawSource('coffee', rawPath, nowMs - 2 * hourMs);
            lines.push(`## [2026-06-11] ingest | Source ${index} (${rawPath})`);
        }
        await writeTopicFile('coffee', 'log.md', lines.join('\n'));
    }
});

function fakeClient(upkeep: { enabled: boolean; lastRunAtMs: number } | null) {
    const jobs: AgentRuntimeCronList['jobs'] = upkeep
        ? [
              {
                  agentId: null,
                  description: null,
                  enabled: upkeep.enabled,
                  id: 'wiki-upkeep',
                  managed: true,
                  name: 'Tavern: Wiki upkeep',
                  schedule: { expr: '30 4 * * *', kind: 'cron' },
                  state: { lastRunAtMs: upkeep.lastRunAtMs, lastRunStatus: 'success' },
                  updatedAt: '2026-06-11T00:00:00Z',
              },
          ]
        : [];
    const client: CompileTriggerClient & { listed: boolean; triggered: string[] } = {
        listed: false,
        triggered: [],
        listCronJobs() {
            client.listed = true;
            return Promise.resolve({ jobs });
        },
        runCronJob(jobId: string) {
            client.triggered.push(jobId);
            return Promise.resolve();
        },
    };
    return client;
}
