import {
    agentRuntimeCapabilityHealthIdSchema,
    agentRuntimeCapabilityHealthListSchema,
    agentRuntimeCapabilityHealthSchema,
    agentRuntimeRefreshCapabilitiesSchema,
    agentRuntimeRoutes,
} from '@tavern/api';
import { json, notFound } from '../tavern/http';
import { publishRuntimeEvent } from '../tavern/runtime-events';
import { getRuntimeCapabilities, getRuntimeCapability, refreshRuntimeCapabilities } from './store';

export async function handleRuntimeCapabilitiesRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.capabilities) {
        return json(agentRuntimeCapabilityHealthListSchema.parse(getRuntimeCapabilities()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.capabilitiesRefresh) {
        const payload = await request.json().catch(() => ({}));
        const parsed = agentRuntimeRefreshCapabilitiesSchema.partial().parse(payload);
        const { health, info } = getRuntimeCapabilities();
        return json(
            agentRuntimeCapabilityHealthListSchema.parse({
                capabilities: publishCapabilityRefreshes(
                    await refreshRuntimeCapabilities({
                        ids: parsed.capabilities,
                    })
                ),
                health,
                info,
            })
        );
    }

    const match = url.pathname.match(/^\/capabilities\/([^/]+)$/u);
    const refreshMatch = url.pathname.match(/^\/capabilities\/([^/]+)\/refresh$/u);
    if (request.method === 'POST' && refreshMatch?.[1]) {
        const parsed = agentRuntimeCapabilityHealthIdSchema.safeParse(
            decodeURIComponent(refreshMatch[1])
        );
        if (!parsed.success) {
            return notFound();
        }
        const [capability] = await refreshRuntimeCapabilities({ ids: [parsed.data] });
        if (!capability) {
            return notFound();
        }
        publishCapabilityRefreshes([capability]);
        return json(agentRuntimeCapabilityHealthSchema.parse(capability));
    }

    if (request.method === 'GET' && match?.[1]) {
        const parsed = agentRuntimeCapabilityHealthIdSchema.safeParse(decodeURIComponent(match[1]));
        if (!parsed.success) {
            return notFound();
        }
        return json(agentRuntimeCapabilityHealthSchema.parse(getRuntimeCapability(parsed.data)));
    }

    return null;
}

function publishCapabilityRefreshes<T extends { id: string }>(capabilities: T[]): T[] {
    for (const capability of capabilities) {
        publishRuntimeEvent({
            capability: capability.id,
            timestamp: new Date().toISOString(),
            type: 'capability.updated',
        });
    }
    return capabilities;
}
