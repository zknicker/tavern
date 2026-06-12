import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { getCortexHealth } from './health';

describe('cortex health', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        ensureRuntimeSchema(initTestDb());
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-cortex-health-'));
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

    test('reports healthy when nothing is escalated', async () => {
        await writeTopicFile('project-notes', 'wiki/alpha.md', '# Alpha');

        const health = await getCortexHealth();

        expect(health.state).toBe('healthy');
        expect(health.todos).toEqual([]);
        expect(health.todoProcessing.runningPath).toBeNull();
        expect(health.status.topicCount).toBe(1);
    });

    test('surfaces todos and the latest report', async () => {
        await writeTopicFile(
            'project-notes',
            'todos/verify-claim.md',
            [
                '---',
                'title: Verify the claim',
                'status: proposed',
                'priority: p1',
                'next_action: "Confirm the claim, then set verified."',
                '---',
            ].join('\n')
        );
        await writeTopicFile(
            'project-notes',
            'todos/agent-task.md',
            ['---', 'title: Agent task', 'status: proposed', '---'].join('\n')
        );
        await writeTopicFile(
            'project-notes',
            '.librarian/scan-results.json',
            JSON.stringify({
                articles: {
                    'wiki/concepts/alpha.md': {
                        quality: { dimensions: { depth: 4 }, flags: [], score: 85 },
                        staleness: { score: 92 },
                    },
                    'wiki/topics/beta.md': {
                        quality: { flags: ['single-source', 'unverified'], score: 42 },
                        staleness: { score: 31 },
                    },
                },
                completed_at: '2026-06-10T06:15:00Z',
                summary: {
                    articles_scanned: 2,
                    avg_quality: 64,
                    avg_staleness: 62,
                    low_quality_count: 1,
                    stale_count: 1,
                },
                threshold: 70,
            })
        );

        const health = await getCortexHealth();

        expect(health.state).toBe('healthy');
        expect(health.todos).toEqual([
            expect.objectContaining({
                path: 'todos/verify-claim.md',
                priority: 'p1',
                question: 'Confirm the claim, then set verified.',
                status: 'proposed',
                title: 'Verify the claim',
                topic: 'project-notes',
            }),
            expect.objectContaining({
                path: 'todos/agent-task.md',
                status: 'proposed',
                title: 'Agent task',
            }),
        ]);
        expect(health.scans).toEqual([
            expect.objectContaining({
                articlesScanned: 2,
                avgQuality: 64,
                completedAt: '2026-06-10T06:15:00Z',
                lowQualityCount: 1,
                staleCount: 1,
                threshold: 70,
                topic: 'project-notes',
            }),
        ]);
        expect(health.scans[0]?.articles).toEqual([
            {
                path: 'wiki/topics/beta.md',
                qualityFlags: ['single-source', 'unverified'],
                qualityScore: 42,
                stalenessScore: 31,
            },
            {
                path: 'wiki/concepts/alpha.md',
                qualityFlags: [],
                qualityScore: 85,
                stalenessScore: 92,
            },
        ]);
    });

    test('skips unparseable scan results', async () => {
        await writeTopicFile('project-notes', 'wiki/alpha.md', '# Alpha');
        await writeTopicFile('project-notes', '.librarian/scan-results.json', 'not json {');

        const health = await getCortexHealth();

        expect(health.scans).toEqual([]);
        expect(health.state).toBe('healthy');
    });

    async function writeTopicFile(topic: string, relativePath: string, content: string) {
        const filePath = path.join(hubPath, 'topics', topic, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content);
    }
});
