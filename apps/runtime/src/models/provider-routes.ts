import {
    agentRuntimeModelProviderCatalogEntrySchema,
    agentRuntimeModelProviderCatalogSchema,
    agentRuntimeModelProviderEnabledSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeUpdateModelProviderSchema,
} from '@tavern/api';
import { runRuntimeDoctor } from '../doctor/runtime-doctor.ts';
import { forbidden, json } from '../tavern/http.ts';
import {
    listEnabledModelProviders,
    listModelProviderCatalog,
    setModelProviderEnabled,
} from './provider-store.ts';

export async function handleModelProviderRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.modelProvidersCatalog) {
        return json(agentRuntimeModelProviderCatalogSchema.parse(await listModelProviderCatalog()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.modelProvidersEnabled) {
        return json(
            agentRuntimeModelProviderEnabledSchema.parse(await listEnabledModelProviders())
        );
    }

    if (segments[0] !== 'model-providers' || !segments[1] || segments[2]) {
        return null;
    }

    if (request.method === 'PUT' || request.method === 'DELETE') {
        const forbiddenResponse = requireTavernMutation(request, 'Model provider settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input =
            request.method === 'DELETE'
                ? { enabled: false }
                : agentRuntimeUpdateModelProviderSchema.parse(await readJson(request));
        const provider = await setModelProviderEnabled({
            enabled: input.enabled,
            providerId: segments[1],
        });
        await runRuntimeDoctor({
            modules: ['models', 'agents'],
            reason: 'provider_changed',
            scope: { kind: 'provider', providerId: segments[1] },
        });
        return json(agentRuntimeModelProviderCatalogEntrySchema.parse(provider));
    }

    return null;
}

function requireTavernMutation(request: Request, label: string) {
    if (
        request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
    ) {
        return null;
    }
    return forbidden(`${label} require a Grotto caller.`);
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
