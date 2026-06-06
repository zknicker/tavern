import {
    agentRuntimeRoutes,
    cortexAddSchemaTermInputSchema,
    cortexBacklinkListSchema,
    cortexCaptureInputSchema,
    cortexCaptureResultSchema,
    cortexDreamReportListSchema,
    cortexDreamReportSchema,
    cortexEditPageInputSchema,
    cortexEditPageResultSchema,
    cortexGraphTraversalSchema,
    cortexImportInputSchema,
    cortexImportResultSchema,
    cortexIngestInputSchema,
    cortexIngestResultSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexPageVersionListSchema,
    cortexRecallInputSchema,
    cortexRecallResultSchema,
    cortexRevertPageInputSchema,
    cortexSaveSchemaInputSchema,
    cortexSaveSettingsSchema,
    cortexSchemaAdditionListSchema,
    cortexSchemaAdditionSchema,
    cortexSchemaRecordSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexSettingsSchema,
    cortexStatusSchema,
} from '@tavern/api';
import { publishCapabilityUpdated } from '../capabilities/events';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { requestRuntimeJobRun } from '../jobs/request';
import { json, notFound } from '../tavern/http';
import { getActiveCortexSchemaRecord, saveActiveCortexSchema } from './cortex-schema';
import { getCortexDb } from './db';
import { getCortexDreamReport, listCortexDreamReports } from './dream-report';
import { editCortexPage } from './edit';
import { ingestCortexSource } from './ingest';
import { listCortexPageVersions } from './page-versions';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    searchCortex,
    traverseCortexGraph,
} from './read';
import { revertCortexPage } from './revert';
import {
    addCortexSchemaTerm,
    deleteUnusedCortexSchemaAddition,
    listCortexSchemaAdditions,
} from './schema-additions';
import { getCortexSettings, saveCortexSettings } from './settings';
import { importCortexSource } from './source-import';
import { captureCortex } from './write';

export async function handleCortexRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/cortex')) {
        return null;
    }

    const db = getCortexDb();

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexStatus) {
        return json(cortexStatusSchema.parse(await getCortexStatus(db)));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexSettings) {
        return json(cortexSettingsSchema.parse(await getCortexSettings(db)));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.cortexSettings) {
        const input = cortexSaveSettingsSchema.parse(await readJson(request));
        const settings = await saveCortexSettings(db, input);
        await refreshRuntimeCapabilities({ ids: ['embeddingModel'] });
        publishCapabilityUpdated('embeddingModel');
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexSettingsSchema.parse(settings));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexSchema) {
        return json(cortexSchemaRecordSchema.parse(await getActiveCortexSchemaRecord(db)));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.cortexSchema) {
        const input = cortexSaveSchemaInputSchema.parse(await readJson(request));
        return json(cortexSchemaRecordSchema.parse(await saveActiveCortexSchema(db, input.schema)));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexSchemaAdditions) {
        return json(cortexSchemaAdditionListSchema.parse(await listCortexSchemaAdditions(db)));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexDreamReports) {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return json(
            cortexDreamReportListSchema.parse({
                reports: await listCortexDreamReports(db, Number.isFinite(limit) ? limit : 20),
            })
        );
    }

    const dreamReportMatch = url.pathname.match(/^\/cortex\/dream-reports\/([^/]+)$/u);
    if (request.method === 'GET' && dreamReportMatch?.[1]) {
        const report = await getCortexDreamReport(db, decodeURIComponent(dreamReportMatch[1]));
        return report ? json(cortexDreamReportSchema.parse(report)) : notFound();
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexSchemaAdditions) {
        const input = cortexAddSchemaTermInputSchema.parse(await readJson(request));
        return json(cortexSchemaAdditionSchema.parse(await addCortexSchemaTerm(db, input)));
    }

    const schemaAdditionMatch = url.pathname.match(/^\/cortex\/schema-additions\/([^/]+)$/u);
    if (request.method === 'DELETE' && schemaAdditionMatch?.[1]) {
        return json(
            cortexSchemaAdditionSchema.parse(
                await deleteUnusedCortexSchemaAddition(
                    db,
                    decodeURIComponent(schemaAdditionMatch[1])
                )
            )
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexPages) {
        const limit = Number(url.searchParams.get('limit') ?? 100);
        return json(
            cortexPageListSchema.parse(
                await listCortexPages(db, Number.isFinite(limit) ? limit : 100)
            )
        );
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexCapture) {
        const input = cortexCaptureInputSchema.parse(await readJson(request));
        const result = await captureCortex(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexCaptureResultSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexIngest) {
        const input = cortexIngestInputSchema.parse(await readJson(request));
        const result = await ingestCortexSource(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexIngestResultSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexImport) {
        const input = cortexImportInputSchema.parse(await readJson(request));
        const result = await importCortexSource(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexImportResultSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexEdit) {
        const input = cortexEditPageInputSchema.parse(await readJson(request));
        const result = await editCortexPage(db, input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexEditPageResultSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexSearch) {
        const input = cortexSearchInputSchema.parse(await readJson(request));
        return json(cortexSearchResultSchema.parse(await searchCortex(db, input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexRecall) {
        const input = cortexRecallInputSchema.parse(await readJson(request));
        return json(cortexRecallResultSchema.parse(await recallCortex(db, input)));
    }

    const pageMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = await getCortexPage(db, decodeURIComponent(pageMatch[1]));
        return page ? json(cortexPageSchema.parse(page)) : notFound();
    }

    const backlinksMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            cortexBacklinkListSchema.parse(
                await listCortexBacklinks(db, decodeURIComponent(backlinksMatch[1]))
            )
        );
    }

    const historyMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/history$/u);
    if (request.method === 'GET' && historyMatch?.[1]) {
        return json(
            cortexPageVersionListSchema.parse(
                await listCortexPageVersions(db, decodeURIComponent(historyMatch[1]))
            )
        );
    }

    const revertMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/revert$/u);
    if (request.method === 'POST' && revertMatch?.[1]) {
        const input = cortexRevertPageInputSchema.parse(await readJson(request));
        const result = await revertCortexPage(db, decodeURIComponent(revertMatch[1]), input);
        requestRuntimeJobRun('cortex-generate-embeddings', { trigger: 'write' });
        return json(cortexEditPageResultSchema.parse(result));
    }

    const graphMatch = url.pathname.match(/^\/cortex\/pages\/([^/]+)\/graph$/u);
    if (request.method === 'GET' && graphMatch?.[1]) {
        const depth = Number(url.searchParams.get('depth') ?? 5);
        const direction = readGraphDirection(url.searchParams.get('direction'));
        return json(
            cortexGraphTraversalSchema.parse(
                await traverseCortexGraph(db, {
                    depth: Number.isFinite(depth) ? depth : 5,
                    direction,
                    root: decodeURIComponent(graphMatch[1]),
                    type: url.searchParams.get('type'),
                })
            )
        );
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}

function readGraphDirection(value: string | null) {
    return value === 'in' || value === 'both' ? value : 'out';
}
