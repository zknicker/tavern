import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveVaultSettingsResultSchema,
    agentRuntimeSaveVaultSettingsSchema,
    agentRuntimeVaultSettingsSchema,
    vaultBacklinkListSchema,
    vaultPageListSchema,
    vaultPageSchema,
    vaultSearchInputSchema,
    vaultSearchResultSchema,
    vaultStatusSchema,
} from '@tavern/api';
import { writeManagedHermesConfigFile } from '../hermes/model-config';
import { requestManagedHermesRestart } from '../hermes/supervisor';
import { forbidden, json, notFound } from '../tavern/http';
import {
    getVaultPage,
    getVaultSettings,
    getVaultStatus,
    listVaultBacklinks,
    listVaultPages,
    saveVaultSettings,
    searchVault,
} from './store';

export async function handleVaultRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/vault')) {
        return null;
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.vaultStatus) {
        return json(vaultStatusSchema.parse(await getVaultStatus()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.vaultSettings) {
        return json(agentRuntimeVaultSettingsSchema.parse(await getVaultSettings()));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.vaultSettings) {
        if (
            request.headers.get(agentRuntimeMutationHeaders.origin) !==
            agentRuntimeMutationOrigins.tavern
        ) {
            return forbidden('Vault settings require a Tavern caller.');
        }
        const input = agentRuntimeSaveVaultSettingsSchema.parse(await readJson(request));
        const settings = await saveVaultSettings(input);
        await writeManagedHermesConfigFile();
        const restartScheduled = requestManagedHermesRestart();
        return json(
            agentRuntimeSaveVaultSettingsResultSchema.parse({ ...settings, restartScheduled })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.vaultPages) {
        return json(vaultPageListSchema.parse(await listVaultPages()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.vaultSearch) {
        const input = vaultSearchInputSchema.parse(await readJson(request));
        return json(vaultSearchResultSchema.parse(await searchVault(input)));
    }

    const backlinksMatch = url.pathname.match(/^\/vault\/pages\/(.+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            vaultBacklinkListSchema.parse(
                await listVaultBacklinks({
                    path: decodeURIComponent(backlinksMatch[1]),
                })
            )
        );
    }

    const pageMatch = url.pathname.match(/^\/vault\/pages\/(.+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = await getVaultPage({
            path: decodeURIComponent(pageMatch[1]),
        });
        return page ? json(vaultPageSchema.parse(page)) : notFound();
    }

    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
