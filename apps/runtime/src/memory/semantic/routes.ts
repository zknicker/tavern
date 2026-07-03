import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveSemanticMemorySettingsResultSchema,
    agentRuntimeSaveSemanticMemorySettingsSchema,
    agentRuntimeSemanticMemorySettingsSchema,
    memoryPathInputSchema,
    memoryPathMutationResultSchema,
    semanticMemoryBacklinkListSchema,
    semanticMemoryCreatePageSchema,
    semanticMemoryMovePathSchema,
    semanticMemoryPageListSchema,
    semanticMemoryPageSchema,
    semanticMemorySavePageSchema,
    semanticMemorySearchInputSchema,
    semanticMemorySearchResultSchema,
    semanticMemoryStatusSchema,
} from '@tavern/api';
import { signalAgentSettingsApplied } from '../../agent-engine/settings-apply';
import { forbidden, json, notFound } from '../../tavern/http';
import {
    createSemanticMemoryFolder,
    createSemanticMemoryPage,
    deleteSemanticMemoryFolder,
    deleteSemanticMemoryPage,
    getSemanticMemoryPage,
    getSemanticMemorySettings,
    getSemanticMemoryStatus,
    listSemanticMemoryBacklinks,
    listSemanticMemoryPages,
    moveSemanticMemoryPath,
    saveSemanticMemoryPage,
    saveSemanticMemorySettings,
    searchSemanticMemory,
} from './store';

export async function handleSemanticMemoryRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/memory')) {
        return null;
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.semanticMemoryStatus) {
        return json(semanticMemoryStatusSchema.parse(await getSemanticMemoryStatus()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.semanticMemorySettings) {
        return json(
            agentRuntimeSemanticMemorySettingsSchema.parse(await getSemanticMemorySettings())
        );
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.semanticMemorySettings) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveSemanticMemorySettingsSchema.parse(await readJson(request));
        const settings = await saveSemanticMemorySettings(input);
        const restartScheduled = signalAgentSettingsApplied();
        return json(
            agentRuntimeSaveSemanticMemorySettingsResultSchema.parse({
                ...settings,
                restartScheduled,
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.semanticMemoryPages) {
        return json(semanticMemoryPageListSchema.parse(await listSemanticMemoryPages()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.semanticMemoryPages) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory file creation');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = semanticMemoryCreatePageSchema.parse(await readJson(request));
        return json(memoryPathMutationResultSchema.parse(await createSemanticMemoryPage(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.semanticMemoryFolders) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory folder creation');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = memoryPathInputSchema.parse(await readJson(request));
        return json(memoryPathMutationResultSchema.parse(await createSemanticMemoryFolder(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.semanticMemoryMovePath) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory path moves');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = semanticMemoryMovePathSchema.parse(await readJson(request));
        return json(memoryPathMutationResultSchema.parse(await moveSemanticMemoryPath(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.semanticMemorySearch) {
        const input = semanticMemorySearchInputSchema.parse(await readJson(request));
        return json(semanticMemorySearchResultSchema.parse(await searchSemanticMemory(input)));
    }

    const backlinksMatch = url.pathname.match(/^\/memory\/pages\/(.+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            semanticMemoryBacklinkListSchema.parse(
                await listSemanticMemoryBacklinks({
                    path: decodeURIComponent(backlinksMatch[1]),
                })
            )
        );
    }

    const pageMatch = url.pathname.match(/^\/memory\/pages\/(.+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = await getSemanticMemoryPage({
            path: decodeURIComponent(pageMatch[1]),
        });
        return page ? json(semanticMemoryPageSchema.parse(page)) : notFound();
    }

    if (request.method === 'PUT' && pageMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory file saves');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const body = readJsonRecord(await readJson(request));
        const input = semanticMemorySavePageSchema.parse({
            ...body,
            path: decodeURIComponent(pageMatch[1]),
        });
        return json(memoryPathMutationResultSchema.parse(await saveSemanticMemoryPage(input)));
    }

    if (request.method === 'DELETE' && pageMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory file deletion');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        return json(
            memoryPathMutationResultSchema.parse(
                await deleteSemanticMemoryPage({ path: decodeURIComponent(pageMatch[1]) })
            )
        );
    }

    const folderMatch = url.pathname.match(/^\/memory\/folders\/(.+)$/u);
    if (request.method === 'DELETE' && folderMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory folder deletion');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        return json(
            memoryPathMutationResultSchema.parse(
                await deleteSemanticMemoryFolder({ path: decodeURIComponent(folderMatch[1]) })
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
