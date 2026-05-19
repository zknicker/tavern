import {
    agentRuntimeRoutes,
    cortexBacklinkListSchema,
    cortexCaptureInputSchema,
    cortexCaptureResultSchema,
    cortexJobNameSchema,
    cortexJobRunSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexRecallInputSchema,
    cortexRecallResultSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
} from '@tavern/api';
import { json, notFound } from '../tavern/http';
import { CortexStore } from './store';

export async function handleCortexRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const store = new CortexStore();

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexStatus) {
        return json(cortexStatusSchema.parse(store.status()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexPages) {
        const limit = Number(url.searchParams.get('limit') ?? 100);
        return json(
            cortexPageListSchema.parse(store.listPages(Number.isFinite(limit) ? limit : 100))
        );
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexCapture) {
        const input = cortexCaptureInputSchema.parse(await readJson(request));
        return json(cortexCaptureResultSchema.parse(store.capture(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexSearch) {
        const input = cortexSearchInputSchema.parse(await readJson(request));
        return json(cortexSearchResultSchema.parse(store.search(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexRecall) {
        const input = cortexRecallInputSchema.parse(await readJson(request));
        return json(cortexRecallResultSchema.parse(store.recall(input)));
    }

    const pageMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = store.getPage(decodeURIComponent(pageMatch[1]));
        return page ? json(cortexPageSchema.parse(page)) : notFound();
    }

    const backlinksMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            cortexBacklinkListSchema.parse(
                store.listBacklinks(decodeURIComponent(backlinksMatch[1]))
            )
        );
    }

    const jobMatch = url.pathname.match(/^\/cortex\/jobs\/([^/]+)\/run$/u);
    if (request.method === 'POST' && jobMatch?.[1]) {
        const job = cortexJobNameSchema.parse(decodeURIComponent(jobMatch[1]));
        return json(cortexJobRunSchema.parse(store.runJob(job)));
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
