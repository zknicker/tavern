import {
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/agent-runtime-protocol';

import { json, notFound } from './http';
import { handleOpenClawProxyRequest } from './proxy';
import { getRuntimeStatus } from './status';

export async function handleTavernRuntimeRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === runtimeRoutes.health) {
        return json(runtimeHealthSchema.parse(getRuntimeStatus().health));
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.status) {
        return json(getRuntimeStatus());
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.events) {
        return json(runtimeEventListSchema.parse({ events: [] }));
    }

    const proxyResponse = await handleOpenClawProxyRequest(request);

    return proxyResponse ?? notFound();
}
