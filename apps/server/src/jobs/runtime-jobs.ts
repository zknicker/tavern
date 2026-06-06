import type { AgentRuntimeJobDetail, AgentRuntimeJobSlug } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
import type { JobDetail, JobSlug, JobSummary } from './contracts.ts';
import { runtimeJobSlugs } from './contracts.ts';

export function isRuntimeJobSlug(slug: JobSlug): slug is AgentRuntimeJobSlug {
    return runtimeJobSlugs.includes(slug as (typeof runtimeJobSlugs)[number]);
}

export async function listRuntimeJobSummaries(): Promise<JobSummary[]> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return [];
    }

    try {
        const result = await client.listRuntimeJobs();
        return result.jobs;
    } catch {
        return [];
    } finally {
        client.close();
    }
}

export async function getRuntimeJobDetail(slug: AgentRuntimeJobSlug): Promise<JobDetail> {
    const client = requireRuntimeClient();
    try {
        const job = await client.getRuntimeJob(slug);
        if (!job) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: `Job "${slug}" was not found.`,
            });
        }
        return mapRuntimeJobDetail(job);
    } finally {
        client.close();
    }
}

export async function runRuntimeJob(
    slug: AgentRuntimeJobSlug,
    payload: Record<string, unknown> | undefined
) {
    const client = requireRuntimeClient();
    try {
        return await client.runRuntimeJob(slug, payload ? { payload } : undefined);
    } finally {
        client.close();
    }
}

function requireRuntimeClient() {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Tavern Runtime is not configured.',
        });
    }
    return client;
}

function mapRuntimeJobDetail(job: AgentRuntimeJobDetail): JobDetail {
    return job;
}
