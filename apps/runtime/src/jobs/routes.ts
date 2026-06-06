import {
    agentRuntimeJobDetailSchema,
    agentRuntimeJobListSchema,
    agentRuntimeJobSlugSchema,
    agentRuntimeRoutes,
    agentRuntimeRunJobInputSchema,
    agentRuntimeRunJobSchema,
} from '@tavern/api';
import { json, notFound } from '../tavern/http';
import { getRuntimeJob, listRuntimeJobs, runRuntimeJob } from './service';

export async function handleRuntimeJobsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.jobs) {
        return json(agentRuntimeJobListSchema.parse(await listRuntimeJobs()));
    }

    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/u);
    if (request.method === 'GET' && jobMatch?.[1]) {
        const parsed = agentRuntimeJobSlugSchema.safeParse(decodeURIComponent(jobMatch[1]));
        if (!parsed.success) {
            return notFound();
        }
        return json(agentRuntimeJobDetailSchema.parse(await getRuntimeJob(parsed.data)));
    }

    const runMatch = url.pathname.match(/^\/jobs\/([^/]+)\/run$/u);
    if (request.method === 'POST' && runMatch?.[1]) {
        const parsed = agentRuntimeJobSlugSchema.safeParse(decodeURIComponent(runMatch[1]));
        if (!parsed.success) {
            return notFound();
        }
        const input = agentRuntimeRunJobInputSchema.parse(await readJson(request));
        return json(
            agentRuntimeRunJobSchema.parse(await runRuntimeJob(parsed.data, input.payload))
        );
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
