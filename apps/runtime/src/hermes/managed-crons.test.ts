import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeCreateCron, AgentRuntimeCron, AgentRuntimeUpdateCron } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { type ManagedCronClient, managedCronDefinitions, syncManagedCrons } from './managed-crons';

describe('managed crons', () => {
    let hubPath: string;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-managed-cron-'));
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

    test('creates all managed crons when the hub has active topics', async () => {
        await seedTopic('project-notes');
        const client = new FakeCronClient();

        const result = await syncManagedCrons(client);

        expect(result.created).toEqual(managedCronDefinitions.map((entry) => entry.name));
        expect(result.skippedReason).toBeNull();
        expect(client.jobs.map((job) => job.name).sort()).toEqual(
            managedCronDefinitions.map((entry) => entry.name).sort()
        );
        expect(client.jobs.every((job) => job.managed)).toBe(true);
        expect(client.jobs.every((job) => job.enabled)).toBe(true);
        expect(client.jobs.every((job) => job.delivery === null)).toBe(true);
    });

    test('skips creation while the hub has no active topics', async () => {
        const client = new FakeCronClient();

        const result = await syncManagedCrons(client);

        expect(result.created).toEqual([]);
        expect(result.skippedReason).toBe('no-active-topics');
        expect(client.jobs).toEqual([]);
    });

    test('repairs schedule and prompt drift without touching pause state', async () => {
        await seedTopic('project-notes');
        const client = new FakeCronClient();
        await syncManagedCrons(client);

        const [job] = client.jobs;
        job.enabled = false;
        job.payload = { kind: 'agentTurn', message: 'tampered prompt' };
        job.schedule = { everyMs: 60_000, kind: 'every' };

        const result = await syncManagedCrons(client);

        expect(result.updated).toEqual([job.name]);
        const repaired = client.jobs.find((entry) => entry.id === job.id);
        expect(repaired?.payload).toEqual({
            kind: 'agentTurn',
            message: managedCronDefinitions.find((entry) => entry.name === job.name)?.prompt,
        });
        expect(repaired?.enabled).toBe(false);
    });

    test('removes retired Tavern-managed crons and leaves user crons alone', async () => {
        await seedTopic('project-notes');
        const client = new FakeCronClient();
        client.jobs.push(
            buildJob({ id: 'stale', name: 'Tavern: Retired job' }),
            buildJob({ id: 'user', name: 'My own reminder' })
        );

        const result = await syncManagedCrons(client);

        expect(result.removed).toEqual(['Tavern: Retired job']);
        expect(client.jobs.some((job) => job.id === 'stale')).toBe(false);
        expect(client.jobs.some((job) => job.id === 'user')).toBe(true);
    });

    test('is idempotent once the managed set is in sync', async () => {
        await seedTopic('project-notes');
        const client = new FakeCronClient();
        await syncManagedCrons(client);

        const result = await syncManagedCrons(client);

        expect(result.created).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.updated).toEqual([]);
    });

    async function seedTopic(slug: string) {
        const topicPath = path.join(hubPath, 'topics', slug, 'wiki');
        await fs.mkdir(topicPath, { recursive: true });
        await fs.writeFile(path.join(topicPath, 'page.md'), '# Page\n');
    }
});

class FakeCronClient implements ManagedCronClient {
    jobs: AgentRuntimeCron[] = [];
    #nextId = 1;

    async createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron> {
        const job = buildJob({
            delivery: input.delivery ?? null,
            enabled: input.enabled ?? true,
            id: `job-${this.#nextId++}`,
            name: input.name,
            payload: input.payload,
            schedule: input.schedule,
        });
        this.jobs.push(job);
        return await Promise.resolve(job);
    }

    async deleteCronJob(jobId: string) {
        this.jobs = this.jobs.filter((job) => job.id !== jobId);
        return await Promise.resolve({ archived: true as const, id: jobId });
    }

    async getCronJob(jobId: string): Promise<AgentRuntimeCron> {
        const job = this.jobs.find((entry) => entry.id === jobId);
        if (!job) {
            throw new Error(`Unknown cron job: ${jobId}`);
        }
        return await Promise.resolve(job);
    }

    async listCronJobs() {
        return await Promise.resolve({ jobs: this.jobs });
    }

    async updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron> {
        const job = await this.getCronJob(jobId);
        if (input.payload) {
            job.payload = input.payload;
        }
        if (input.schedule) {
            job.schedule = input.schedule;
        }
        if (input.enabled !== undefined) {
            job.enabled = input.enabled;
        }
        return job;
    }
}

function buildJob(overrides: Partial<AgentRuntimeCron> & Pick<AgentRuntimeCron, 'id' | 'name'>) {
    const now = new Date().toISOString();
    return {
        agentId: null,
        createdAt: now,
        deleteAfterRun: false,
        delivery: null,
        description: null,
        enabled: true,
        managed: overrides.name.startsWith('Tavern: '),
        payload: { kind: 'agentTurn' as const, message: 'noop' },
        schedule: { everyMs: 60_000, kind: 'every' as const },
        state: {},
        updatedAt: now,
        wakeMode: 'now' as const,
        ...overrides,
    } satisfies AgentRuntimeCron;
}
