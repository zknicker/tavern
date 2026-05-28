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
    cortexSaveSettingsSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexSettingsSchema,
    cortexStatusSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { requestRuntimeJobRun } from '../jobs/request';
import { json, notFound } from '../tavern/http';
import { runCortexJob } from './jobs';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    searchCortex,
} from './read';
import { getCortexSettings, saveCortexSettings } from './settings';
import { createCortexVectorDatabase } from './vector-db/native-vector-db';
import { captureCortex } from './write';

export async function handleCortexRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const db = getDb();
    const vectorDatabase = createCortexVectorDatabase();

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexStatus) {
        return json(cortexStatusSchema.parse(await getCortexStatus(db, vectorDatabase)));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexSettings) {
        return json(cortexSettingsSchema.parse(getCortexSettings(db)));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.cortexSettings) {
        const input = cortexSaveSettingsSchema.parse(await readJson(request));
        const settings = saveCortexSettings(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexSettingsSchema.parse(settings));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexPages) {
        const limit = Number(url.searchParams.get('limit') ?? 100);
        return json(
            cortexPageListSchema.parse(listCortexPages(db, Number.isFinite(limit) ? limit : 100))
        );
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexCapture) {
        const input = cortexCaptureInputSchema.parse(await readJson(request));
        const result = captureCortex(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexCaptureResultSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexSearch) {
        const input = cortexSearchInputSchema.parse(await readJson(request));
        return json(cortexSearchResultSchema.parse(await searchCortex(db, input, vectorDatabase)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexRecall) {
        const input = cortexRecallInputSchema.parse(await readJson(request));
        return json(cortexRecallResultSchema.parse(await recallCortex(db, input, vectorDatabase)));
    }

    const pageMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = getCortexPage(db, decodeURIComponent(pageMatch[1]));
        return page ? json(cortexPageSchema.parse(page)) : notFound();
    }

    const backlinksMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            cortexBacklinkListSchema.parse(
                listCortexBacklinks(db, decodeURIComponent(backlinksMatch[1]))
            )
        );
    }

    const jobMatch = url.pathname.match(/^\/cortex\/jobs\/([^/]+)\/run$/u);
    if (request.method === 'POST' && jobMatch?.[1]) {
        const job = cortexJobNameSchema.parse(decodeURIComponent(jobMatch[1]));
        return json(cortexJobRunSchema.parse(await runCortexJob(db, job, vectorDatabase)));
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
