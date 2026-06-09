import {
    agentRuntimeRoutes,
    cortexBacklinkListSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
    cortexTopicListSchema,
} from '@tavern/api';
import { json, notFound } from '../tavern/http';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    listCortexTopics,
    searchCortex,
} from './store';

export async function handleCortexRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/cortex')) {
        return null;
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexStatus) {
        return json(cortexStatusSchema.parse(await getCortexStatus()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexTopics) {
        return json(
            cortexTopicListSchema.parse(
                await listCortexTopics({
                    includeArchived: url.searchParams.get('includeArchived') === 'true',
                })
            )
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.cortexPages) {
        return json(
            cortexPageListSchema.parse(
                await listCortexPages({
                    includeArchived: url.searchParams.get('includeArchived') === 'true',
                    topic: url.searchParams.get('topic'),
                })
            )
        );
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.cortexSearch) {
        const input = cortexSearchInputSchema.parse(await readJson(request));
        return json(cortexSearchResultSchema.parse(await searchCortex(input)));
    }

    const backlinksMatch = url.pathname.match(
        /^\/cortex\/topics\/([^/]+)\/pages\/(.+)\/backlinks$/u
    );
    if (request.method === 'GET' && backlinksMatch?.[1] && backlinksMatch[2]) {
        return json(
            cortexBacklinkListSchema.parse(
                await listCortexBacklinks({
                    path: decodeURIComponent(backlinksMatch[2]),
                    topic: decodeURIComponent(backlinksMatch[1]),
                })
            )
        );
    }

    const pageMatch = url.pathname.match(/^\/cortex\/topics\/([^/]+)\/pages\/(.+)$/u);
    if (request.method === 'GET' && pageMatch?.[1] && pageMatch[2]) {
        const page = await getCortexPage({
            path: decodeURIComponent(pageMatch[2]),
            topic: decodeURIComponent(pageMatch[1]),
        });
        return page ? json(cortexPageSchema.parse(page)) : notFound();
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
