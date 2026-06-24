import {
    agentRuntimeIntegrationIdSchema,
    agentRuntimeIntegrationListSchema,
    agentRuntimeIntegrationSchema,
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveMerchbaseSettingsSchema,
} from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { badRequest, forbidden, json, notFound } from '../tavern/http';
import {
    applyMerchbaseAgentCapabilityEnablement,
    ensureMerchbaseSkillForEnablement,
    getMerchbaseIntegration,
    getMerchbaseSettings,
    listRuntimeIntegrations,
    queryMerchbaseAction,
    queryMerchbaseSalesSeries,
    saveMerchbaseSettings,
} from './merchbase';

export async function handleIntegrationsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'integrations') {
        return null;
    }

    if (request.method === 'GET' && !segments[1]) {
        return json(
            agentRuntimeIntegrationListSchema.parse({ integrations: listRuntimeIntegrations() })
        );
    }

    if (request.method === 'GET' && segments[1] && !segments[2]) {
        const parsedId = agentRuntimeIntegrationIdSchema.safeParse(segments[1]);
        return parsedId.success
            ? json(agentRuntimeIntegrationSchema.parse(getMerchbaseIntegration()))
            : notFound();
    }

    if (
        request.method === 'GET' &&
        url.pathname === agentRuntimeRoutes.integrationMerchbaseSettings
    ) {
        return json(agentRuntimeMerchbaseSettingsSchema.parse(getMerchbaseSettings()));
    }

    if (
        request.method === 'PUT' &&
        url.pathname === agentRuntimeRoutes.integrationMerchbaseSettings
    ) {
        const forbiddenResponse = requireTavernMutation(request, 'MerchBase settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveMerchbaseSettingsSchema.parse(await readJson(request));
        const previous = getMerchbaseSettings();
        const requestedEnabled = input.enabled ?? previous.enabled;
        if (requestedEnabled) {
            try {
                await ensureMerchbaseSkillForEnablement();
            } catch (error) {
                return badRequest(error instanceof Error ? error.message : String(error));
            }
        }
        const settings = saveMerchbaseSettings(input);
        if (previous.enabled !== settings.enabled) {
            await applyMerchbaseAgentCapabilityEnablement(settings.enabled).catch(() => undefined);
        }
        await refreshRuntimeCapabilities({
            ids: ['integration.merchbase'],
            publishUpdated: true,
        });
        return json(agentRuntimeMerchbaseSettingsSchema.parse(settings));
    }

    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.integrationMerchbaseSalesSeries
    ) {
        try {
            const input = agentRuntimeMerchbaseSalesSeriesInputSchema.parse(
                await readJson(request)
            );
            return json(
                agentRuntimeMerchbaseSalesSeriesSchema.parse(await queryMerchbaseSalesSeries(input))
            );
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.integrationMerchbaseAction
    ) {
        try {
            const input = agentRuntimeMerchbaseActionInputSchema.parse(await readJson(request));
            return json(
                agentRuntimeMerchbaseActionResultSchema.parse(await queryMerchbaseAction(input))
            );
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
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
    return forbidden(`${label} requires a Tavern caller.`);
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
