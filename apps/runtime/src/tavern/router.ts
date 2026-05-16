import {
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/agent-runtime-protocol';
import { listTavernRuntimeEvents } from './channel-store';
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
        const afterCursor = Number(url.searchParams.get('after_cursor') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 500);
        return json(
            runtimeEventListSchema.parse({
                events: listTavernRuntimeEvents({
                    afterCursor: Number.isFinite(afterCursor) ? afterCursor : 0,
                    limit: Number.isFinite(limit) ? limit : 500,
                }).map((entry) => entry.event),
            })
        );
    }

    const proxyResponse = await handleOpenClawProxyRequest(request);

    return proxyResponse ?? notFound();
}
