import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveVaultSettingsResultSchema,
    agentRuntimeSaveVaultSettingsSchema,
    agentRuntimeVaultSettingsSchema,
    vaultBacklinkListSchema,
    vaultCreatePageSchema,
    vaultMovePathSchema,
    vaultPageListSchema,
    vaultPageSchema,
    vaultPathInputSchema,
    vaultPathMutationResultSchema,
    vaultSavePageSchema,
    vaultSearchInputSchema,
    vaultSearchResultSchema,
    vaultStatusSchema,
} from '@tavern/api';
import { writeManagedHermesConfigFile } from '../hermes/model-config';
import { requestManagedHermesRestart } from '../hermes/supervisor';
import { forbidden, json, notFound } from '../tavern/http';
import {
    createVaultFolder,
    createVaultPage,
    deleteVaultFolder,
    deleteVaultPage,
    getVaultPage,
    getVaultSettings,
    getVaultStatus,
    listVaultBacklinks,
    listVaultPages,
    moveVaultPath,
    saveVaultPage,
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
        const forbiddenResponse = requireTavernMutation(request, 'Vault settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
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

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.vaultPages) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault page creation');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = vaultCreatePageSchema.parse(await readJson(request));
        return json(vaultPathMutationResultSchema.parse(await createVaultPage(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.vaultFolders) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault folder creation');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = vaultPathInputSchema.parse(await readJson(request));
        return json(vaultPathMutationResultSchema.parse(await createVaultFolder(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.vaultMovePath) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault path moves');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = vaultMovePathSchema.parse(await readJson(request));
        return json(vaultPathMutationResultSchema.parse(await moveVaultPath(input)));
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

    if (request.method === 'PUT' && pageMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault page saves');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const body = readJsonRecord(await readJson(request));
        const input = vaultSavePageSchema.parse({
            ...body,
            path: decodeURIComponent(pageMatch[1]),
        });
        return json(vaultPathMutationResultSchema.parse(await saveVaultPage(input)));
    }

    if (request.method === 'DELETE' && pageMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault page deletion');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        return json(
            vaultPathMutationResultSchema.parse(
                await deleteVaultPage({ path: decodeURIComponent(pageMatch[1]) })
            )
        );
    }

    const folderMatch = url.pathname.match(/^\/vault\/folders\/(.+)$/u);
    if (request.method === 'DELETE' && folderMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Vault folder deletion');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        return json(
            vaultPathMutationResultSchema.parse(
                await deleteVaultFolder({ path: decodeURIComponent(folderMatch[1]) })
            )
        );
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

function readJsonRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}
