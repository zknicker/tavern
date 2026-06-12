import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import {
    buildTodoDrainPrompt,
    getWikiTodoProcessing,
    runWikiTodoDrain,
    todoDrainCooldownMs,
} from './todo-drain';
import { listWikiTodoCompletions, listWikiTodos } from './todos';

const nowMs = Date.parse('2026-06-11T12:00:00Z');

describe('wiki todo drain', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-todo-drain-'));
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

    test('lists todos sorted proposed-first then by priority, skipping notes and indexes', async () => {
        await writeRecord('coffee', 'todos/_index.md', { title: 'Index' });
        await writeRecord('coffee', 'todos/note.md', { title: 'Just a note' });
        await writeRecord('coffee', 'todos/later.md', {
            priority: 'p3',
            status: 'proposed',
            title: 'Low priority',
        });
        await writeRecord('coffee', 'todos/urgent.md', {
            next_action: 'Research corroborating sources.',
            priority: 'p0',
            status: 'proposed',
            title: 'Urgent',
        });
        await writeRecord('coffee', 'todos/stuck.md', {
            priority: 'p0',
            status: 'blocked',
            title: 'Stuck',
        });

        const todos = await listWikiTodos();

        expect(todos.map((todo) => todo.title)).toEqual(['Urgent', 'Low priority', 'Stuck']);
        expect(todos[0]?.question).toBe('Research corroborating sources.');
    });

    test('reads recent completions from log.md todo entries', async () => {
        await writeRecord('coffee', 'wiki/alpha.md', { title: 'Alpha' });
        const logPath = path.join(hubPath, 'topics', 'coffee', 'log.md');
        await fs.writeFile(
            logPath,
            [
                '## [2026-06-10] todo | Merge duplicate extraction notes — merged and recompiled.',
                '## [2026-06-11] compile | 1 source compiled',
                '## [2026-06-11] todo | Verify the bloom claim — confirmed against SCA guide.',
            ].join('\n')
        );

        expect(await listWikiTodoCompletions()).toEqual([
            {
                date: '2026-06-11',
                detail: 'Verify the bloom claim — confirmed against SCA guide.',
                topic: 'coffee',
            },
            {
                date: '2026-06-10',
                detail: 'Merge duplicate extraction notes — merged and recompiled.',
                topic: 'coffee',
            },
        ]);
    });

    test('drains the top todo through one agent turn and records the time', async () => {
        await writeRecord('coffee', 'todos/urgent.md', {
            next_action: 'Research corroborating sources.',
            priority: 'p0',
            status: 'proposed',
            title: 'Urgent',
        });
        const client = fakeClient('Done: corroborated and ingested.');

        const outcome = await runWikiTodoDrain(client, getDb(), nowMs);

        expect(outcome).toEqual({
            kind: 'drained',
            path: 'todos/urgent.md',
            summary: 'Done: corroborated and ingested.',
            topic: 'coffee',
        });
        expect(client.prompts).toHaveLength(1);
        expect(client.prompts[0]).toContain('todos/urgent.md');
        expect(getWikiTodoProcessing(getDb()).lastRunAtMs).toBe(nowMs);
    });

    test('cools down between drains', async () => {
        await writeRecord('coffee', 'todos/urgent.md', {
            priority: 'p0',
            status: 'proposed',
            title: 'Urgent',
        });
        const client = fakeClient('First.');
        await runWikiTodoDrain(client, getDb(), nowMs);

        const outcome = await runWikiTodoDrain(client, getDb(), nowMs + 60_000);

        expect(outcome).toEqual({ kind: 'cooling', nextAtMs: nowMs + todoDrainCooldownMs });
        expect(client.prompts).toHaveLength(1);
    });

    test('idles without an agent run when only blocked todos remain', async () => {
        await writeRecord('coffee', 'todos/stuck.md', {
            next_action: 'Find the paywalled study.',
            status: 'blocked',
            title: 'Stuck',
        });
        const client = fakeClient('Should not run.');

        expect(await runWikiTodoDrain(client, getDb(), nowMs)).toEqual({ kind: 'idle' });
        expect(client.prompts).toHaveLength(0);
    });

    test('drain prompt works one record and includes the give-up rule', () => {
        const prompt = buildTodoDrainPrompt({
            path: 'todos/urgent.md',
            priority: 'p0',
            question: 'Research corroborating sources.',
            status: 'proposed',
            title: 'Urgent',
            topic: 'coffee',
            updatedAt: '2026-06-11T00:00:00.000Z',
        });

        expect(prompt).toContain('exactly one todo record');
        expect(prompt).toContain('todos/urgent.md');
        expect(prompt).toContain('delete the record file');
        expect(prompt).toContain('status: blocked');
        expect(prompt).toContain('do not park work on the');
        expect(prompt).toContain('Do not start any other todo work');
        expect(prompt).toContain('Re-score any articles you changed');
    });

    async function writeRecord(
        topic: string,
        relativePath: string,
        frontmatter: Record<string, string>
    ) {
        const filePath = path.join(hubPath, 'topics', topic, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const lines = [
            '---',
            ...Object.entries(frontmatter).map(([k, v]) => `${k}: "${v}"`),
            '---',
        ];
        await fs.writeFile(filePath, `${lines.join('\n')}\n`);
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
