import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getCortexHealth } from './health';

describe('cortex health', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-cortex-health-'));
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

    test('reports healthy when nothing is escalated', async () => {
        await writeTopicFile('project-notes', 'wiki/alpha.md', '# Alpha');

        const health = await getCortexHealth();

        expect(health.state).toBe('healthy');
        expect(health.escalations).toEqual([]);
        expect(health.status.topicCount).toBe(1);
    });

    test('needs attention with escalations and surfaces the latest report', async () => {
        await writeTopicFile(
            'project-notes',
            'inventory/verify-claim.md',
            [
                '---',
                'title: Verify the claim',
                'status: proposed',
                'owner: user',
                'priority: p1',
                'next_action: "Confirm the claim, then set verified."',
                '---',
            ].join('\n')
        );
        await writeTopicFile(
            'project-notes',
            'inventory/agent-task.md',
            ['---', 'title: Agent task', 'status: proposed', '---'].join('\n')
        );
        await writeTopicFile(
            'project-notes',
            '.librarian/REPORT.md',
            '# Librarian Report\n\n3 articles scanned.'
        );

        const health = await getCortexHealth();

        expect(health.state).toBe('needs_attention');
        expect(health.escalations).toEqual([
            expect.objectContaining({
                path: 'inventory/verify-claim.md',
                priority: 'p1',
                question: 'Confirm the claim, then set verified.',
                title: 'Verify the claim',
                topic: 'project-notes',
            }),
        ]);
        expect(health.reports).toEqual([
            expect.objectContaining({
                body: expect.stringContaining('3 articles scanned'),
                topic: 'project-notes',
            }),
        ]);
    });

    async function writeTopicFile(topic: string, relativePath: string, content: string) {
        const filePath = path.join(hubPath, 'topics', topic, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content);
    }
});
