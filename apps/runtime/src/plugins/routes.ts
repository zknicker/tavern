import {
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeCompleteGoogleOAuthSchema,
    agentRuntimeGoogleCalendarEventsListInputSchema,
    agentRuntimeGoogleCalendarEventsListSchema,
    agentRuntimeGoogleOAuthPollSchema,
    agentRuntimeGoogleOAuthStartSchema,
    agentRuntimeGoogleSettingsSchema,
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimePluginIdSchema,
    agentRuntimePluginListSchema,
    agentRuntimePluginSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveBrowserSettingsSchema,
    agentRuntimeSaveGoogleSettingsSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
    agentRuntimeStartGoogleOAuthSchema,
} from '@tavern/api';
import { browserPluginHealthCapabilityId } from '@tavern/api/plugins/browser';
import { googleCalendarPluginHealthCapabilityId } from '@tavern/api/plugins/google';
import { merchbasePluginHealthCapabilityId } from '@tavern/api/plugins/merchbase';
import { refreshRuntimeCapabilities } from '../capabilities/store';
import { badRequest, forbidden, json, notFound } from '../tavern/http';
import {
    getBrowserPlugin,
    getBrowserSettings,
    openBrowser,
    restartBrowser,
    saveBrowserSettings,
} from './browser.ts';
import {
    completeGoogleOAuth,
    disconnectGoogleOAuth,
    getGooglePlugin,
    getGoogleSettings,
    pollGoogleOAuth,
    queryGoogleCalendarEvents,
    saveGoogleSettings,
    startGoogleOAuth,
} from './google';
import { materializePluginSkills } from './materialize-skills.ts';
import {
    getMerchbasePlugin,
    getMerchbaseSettings,
    listRuntimePlugins,
    queryMerchbaseAction,
    queryMerchbaseSalesSeries,
    saveMerchbaseSettings,
} from './merchbase';

export async function handlePluginsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'plugins') {
        return null;
    }

    if (request.method === 'GET' && !segments[1]) {
        return json(agentRuntimePluginListSchema.parse({ plugins: listRuntimePlugins() }));
    }

    if (request.method === 'GET' && segments[1] && !segments[2]) {
        const parsedId = agentRuntimePluginIdSchema.safeParse(segments[1]);
        return parsedId.success
            ? json(agentRuntimePluginSchema.parse(getRuntimePlugin(parsedId.data)))
            : notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.pluginBrowserSettings) {
        return json(agentRuntimeBrowserSettingsSchema.parse(await getBrowserSettings()));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.pluginBrowserSettings) {
        const forbiddenResponse = requireTavernMutation(request, 'Browser settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveBrowserSettingsSchema.parse(await readJson(request));
        let settings: Awaited<ReturnType<typeof saveBrowserSettings>>;
        try {
            settings = await saveBrowserSettings(input);
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        try {
            await materializePluginSkills();
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        await refreshRuntimeCapabilities({
            ids: [browserPluginHealthCapabilityId],
            publishUpdated: true,
        });
        return json(agentRuntimeBrowserSettingsSchema.parse(settings));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.pluginBrowserOpen) {
        const forbiddenResponse = requireTavernMutation(request, 'Browser actions');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        try {
            const result = await openBrowser();
            await refreshRuntimeCapabilities({
                ids: [browserPluginHealthCapabilityId],
                publishUpdated: true,
            });
            return json(agentRuntimeBrowserActionResultSchema.parse(result));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.pluginBrowserRestart) {
        const forbiddenResponse = requireTavernMutation(request, 'Browser actions');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        try {
            const result = await restartBrowser();
            await refreshRuntimeCapabilities({
                ids: [browserPluginHealthCapabilityId],
                publishUpdated: true,
            });
            return json(agentRuntimeBrowserActionResultSchema.parse(result));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.pluginMerchbaseSettings) {
        return json(agentRuntimeMerchbaseSettingsSchema.parse(getMerchbaseSettings()));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.pluginMerchbaseSettings) {
        const forbiddenResponse = requireTavernMutation(request, 'MerchBase settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveMerchbaseSettingsSchema.parse(await readJson(request));
        let settings: ReturnType<typeof saveMerchbaseSettings>;
        try {
            settings = saveMerchbaseSettings(input);
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        try {
            await materializePluginSkills();
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        await refreshRuntimeCapabilities({
            ids: [merchbasePluginHealthCapabilityId],
            publishUpdated: true,
        });
        return json(agentRuntimeMerchbaseSettingsSchema.parse(settings));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.pluginGoogleSettings) {
        return json(agentRuntimeGoogleSettingsSchema.parse(getGoogleSettings()));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.pluginGoogleSettings) {
        const forbiddenResponse = requireTavernMutation(request, 'Google settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveGoogleSettingsSchema.parse(await readJson(request));
        let settings: ReturnType<typeof saveGoogleSettings>;
        try {
            settings = saveGoogleSettings(input);
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        try {
            await materializePluginSkills();
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
        await refreshRuntimeCapabilities({
            ids: [googleCalendarPluginHealthCapabilityId],
            publishUpdated: true,
        });
        return json(agentRuntimeGoogleSettingsSchema.parse(settings));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.pluginGoogleOAuthStart) {
        const forbiddenResponse = requireTavernMutation(request, 'Google OAuth');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        try {
            const input = agentRuntimeStartGoogleOAuthSchema.parse(await readJson(request));
            return json(agentRuntimeGoogleOAuthStartSchema.parse(await startGoogleOAuth(input)));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (
        request.method === 'POST' &&
        segments.length === 6 &&
        segments[1] === 'google' &&
        segments[2] === 'oauth' &&
        segments[3] === 'sessions' &&
        segments[5] === 'complete'
    ) {
        const forbiddenResponse = requireTavernMutation(request, 'Google OAuth');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        try {
            const input = agentRuntimeCompleteGoogleOAuthSchema.parse(await readJson(request));
            const result = await completeGoogleOAuth(segments[4] ?? '', input);
            if (result.status !== 'pending') {
                await refreshRuntimeCapabilities({
                    ids: [googleCalendarPluginHealthCapabilityId],
                    publishUpdated: true,
                });
            }
            return json(agentRuntimeGoogleOAuthPollSchema.parse(result));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (
        request.method === 'GET' &&
        segments.length === 5 &&
        segments[1] === 'google' &&
        segments[2] === 'oauth' &&
        segments[3] === 'sessions'
    ) {
        const result = pollGoogleOAuth(segments[4] ?? '');
        if (result.status !== 'pending') {
            await refreshRuntimeCapabilities({
                ids: [googleCalendarPluginHealthCapabilityId],
                publishUpdated: true,
            });
        }
        return json(agentRuntimeGoogleOAuthPollSchema.parse(result));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.pluginGoogleDisconnect) {
        const forbiddenResponse = requireTavernMutation(request, 'Google OAuth');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const settings = disconnectGoogleOAuth();
        await refreshRuntimeCapabilities({
            ids: [googleCalendarPluginHealthCapabilityId],
            publishUpdated: true,
        });
        return json(agentRuntimeGoogleSettingsSchema.parse(settings));
    }

    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.pluginGoogleCalendarEvents
    ) {
        try {
            const input = agentRuntimeGoogleCalendarEventsListInputSchema.parse(
                await readJson(request)
            );
            return json(
                agentRuntimeGoogleCalendarEventsListSchema.parse(
                    await queryGoogleCalendarEvents(input)
                )
            );
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (
        request.method === 'POST' &&
        url.pathname === agentRuntimeRoutes.pluginMerchbaseSalesSeries
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

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.pluginMerchbaseAction) {
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

function getRuntimePlugin(id: ReturnType<typeof agentRuntimePluginIdSchema.parse>) {
    switch (id) {
        case 'browser':
            return getBrowserPlugin();
        case 'google':
            return getGooglePlugin();
        case 'merchbase':
            return getMerchbasePlugin();
    }
}

function requireTavernMutation(request: Request, label: string) {
    if (
        request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
    ) {
        return null;
    }
    return forbidden(`${label} requires a Grotto caller.`);
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
