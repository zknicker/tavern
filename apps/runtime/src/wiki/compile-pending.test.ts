import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { isCompileDue, listPendingCompileTopics } from './compile-pending';
import { getWikiCompileStatus, runWikiCompile, wikiCompileCooldownMs } from './compile-run';

const nowMs = Date.parse('2026-06-11T12:00:00Z');
const hourMs = 60 * 60 * 1000;

describe('wiki compile pipeline', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-compile-pending-'));
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
                oldestPendingAtMs: nowMs - 3 * hourMs,
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

    test('topics without a log have nothing pending', async () => {
        await writeTopicFile('coffee', 'wiki/alpha.md', '# Alpha');

        expect(await listPendingCompileTopics()).toEqual([]);
    });

    test('inbox files count as pending sources', async () => {
        await writeRawSource('coffee', 'inbox/dropped-article.pdf', nowMs - 2 * hourMs);
        await writeRawSource('coffee', 'inbox/.hidden', nowMs - hourMs);

        expect(await listPendingCompileTopics()).toEqual([
            {
                newestPendingAtMs: nowMs - 2 * hourMs,
                oldestPendingAtMs: nowMs - 2 * hourMs,
                pendingCount: 1,
                topic: 'coffee',
            },
        ]);
    });

    test('compile is due on pile-up or straggler age, after the settle window', () => {
        const settled = { newestPendingAtMs: nowMs - hourMs };

        // A batch still settling never compiles, regardless of count.
        expect(
            isCompileDue(
                {
                    newestPendingAtMs: nowMs - 5 * 60 * 1000,
                    oldestPendingAtMs: nowMs - 8 * hourMs,
                    pendingCount: 9,
                    topic: 'coffee',
                },
                nowMs
            )
        ).toBe(false);
        // Pile-up rule.
        expect(
            isCompileDue(
                { ...settled, oldestPendingAtMs: nowMs - hourMs, pendingCount: 5, topic: 'coffee' },
                nowMs
            )
        ).toBe(true);
        expect(
            isCompileDue(
                { ...settled, oldestPendingAtMs: nowMs - hourMs, pendingCount: 4, topic: 'coffee' },
                nowMs
            )
        ).toBe(false);
        // Straggler rule: one source waiting past the age limit compiles anyway.
        expect(
            isCompileDue(
                {
                    ...settled,
                    oldestPendingAtMs: nowMs - 7 * hourMs,
                    pendingCount: 1,
                    topic: 'coffee',
                },
                nowMs
            )
        ).toBe(true);
    });

    test('runs one compile turn for due topics and records the time', async () => {
        await seedDueTopic();
        const client = fakeClient('Compiled 1 source into extraction.md.');

        const outcome = await runWikiCompile(client, getDb(), nowMs);

        expect(outcome).toEqual({
            kind: 'compiled',
            summary: 'Compiled 1 source into extraction.md.',
            topics: ['coffee'],
        });
        expect(client.prompts).toHaveLength(1);
        expect(client.prompts[0]).toContain('coffee');
        expect(client.prompts[0]).toContain('file it as a proposed todo');
        expect(client.prompts[0]).toContain('re-score changed articles');
        expect(getWikiCompileStatus(getDb()).lastRunAtMs).toBe(nowMs);
    });

    test('cools down between compile turns', async () => {
        await seedDueTopic();
        const client = fakeClient('First.');
        await runWikiCompile(client, getDb(), nowMs);

        const outcome = await runWikiCompile(client, getDb(), nowMs + 60_000);

        expect(outcome).toEqual({ kind: 'cooling', nextAtMs: nowMs + wikiCompileCooldownMs });
        expect(client.prompts).toHaveLength(1);
    });

    test('idles without an agent run when nothing is due', async () => {
        await writeTopicFile('coffee', 'wiki/alpha.md', '# Alpha');
        const client = fakeClient('Should not run.');

        expect(await runWikiCompile(client, getDb(), nowMs)).toEqual({ kind: 'idle' });
        expect(client.prompts).toHaveLength(0);
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

function fakeClient(reply: string) {
    const client = {
        prompts: [] as string[],
        streamChat(input: { content: string; sessionKey: string; title?: null | string }) {
            client.prompts.push(input.content);
            return (async function* () {
                yield { data: { content: reply }, event: 'assistant.completed' };
            })();
        },
    };
    return client;
}
