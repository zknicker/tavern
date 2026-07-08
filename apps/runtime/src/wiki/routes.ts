import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveWikiSettingsResultSchema,
    agentRuntimeSaveWikiSettingsSchema,
    agentRuntimeWikiSettingsSchema,
    wikiBacklinkListSchema,
    wikiCreatePageSchema,
    wikiMovePathSchema,
    wikiPageListSchema,
    wikiPageSchema,
    wikiPathInputSchema,
    wikiPathMutationResultSchema,
    wikiSavePageSchema,
    wikiSearchInputSchema,
    wikiSearchResultSchema,
    wikiStatusSchema,
} from '@tavern/api';
import { signalAgentSettingsApplied } from '../agent-engine/settings-apply';
import { forbidden, json, notFound } from '../tavern/http';
import {
    createWikiFolder,
    createWikiPage,
    deleteWikiFolder,
    deleteWikiPage,
    getWikiPage,
    getWikiSettings,
    getWikiStatus,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    saveWikiPage,
    saveWikiSettings,
    searchWiki,
} from './store';

export async function handleWikiRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/wiki')) {
        return null;
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.wikiStatus) {
        return json(wikiStatusSchema.parse(await getWikiStatus()));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.wikiSettings) {
        return json(agentRuntimeWikiSettingsSchema.parse(await getWikiSettings()));
    }

    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.wikiSettings) {
        const forbiddenResponse = requireTavernMutation(request, 'Wiki settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveWikiSettingsSchema.parse(await readJson(request));
        const settings = await saveWikiSettings(input);
        const restartScheduled = signalAgentSettingsApplied();
        return json(
            agentRuntimeSaveWikiSettingsResultSchema.parse({
                ...settings,
                restartScheduled,
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.wikiPages) {
        return json(wikiPageListSchema.parse(await listWikiPages()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.wikiPages) {
        const blockedResponse = requireWikiWrite(request, 'Wiki page creation');
        if (blockedResponse) {
            return blockedResponse;
        }
        const input = wikiCreatePageSchema.parse(await readJson(request));
        return json(wikiPathMutationResultSchema.parse(await createWikiPage(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.wikiFolders) {
        const blockedResponse = requireWikiWrite(request, 'Wiki folder creation');
        if (blockedResponse) {
            return blockedResponse;
        }
        const input = wikiPathInputSchema.parse(await readJson(request));
        return json(wikiPathMutationResultSchema.parse(await createWikiFolder(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.wikiMovePath) {
        const blockedResponse = requireWikiWrite(request, 'Wiki path moves');
        if (blockedResponse) {
            return blockedResponse;
        }
        const input = wikiMovePathSchema.parse(await readJson(request));
        return json(wikiPathMutationResultSchema.parse(await moveWikiPath(input)));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.wikiSearch) {
        const input = wikiSearchInputSchema.parse(await readJson(request));
        return json(wikiSearchResultSchema.parse(await searchWiki(input)));
    }

    const backlinksMatch = url.pathname.match(/^\/wiki\/pages\/(.+)\/backlinks$/u);
    if (request.method === 'GET' && backlinksMatch?.[1]) {
        return json(
            wikiBacklinkListSchema.parse(
                await listWikiBacklinks({
                    path: decodeURIComponent(backlinksMatch[1]),
                })
            )
        );
    }

    const pageMatch = url.pathname.match(/^\/wiki\/pages\/(.+)$/u);
    if (request.method === 'GET' && pageMatch?.[1]) {
        const page = await getWikiPage({
            path: decodeURIComponent(pageMatch[1]),
        });
        return page ? json(wikiPageSchema.parse(page)) : notFound();
    }

    if (request.method === 'PUT' && pageMatch?.[1]) {
        const blockedResponse = requireWikiWrite(request, 'Wiki page saves');
        if (blockedResponse) {
            return blockedResponse;
        }
        const body = readJsonRecord(await readJson(request));
        const input = wikiSavePageSchema.parse({
            ...body,
            path: decodeURIComponent(pageMatch[1]),
        });
        return json(wikiPathMutationResultSchema.parse(await saveWikiPage(input)));
    }

    if (request.method === 'DELETE' && pageMatch?.[1]) {
        const blockedResponse = requireWikiWrite(request, 'Wiki page deletion');
        if (blockedResponse) {
            return blockedResponse;
        }
        return json(
            wikiPathMutationResultSchema.parse(
                await deleteWikiPage({ path: decodeURIComponent(pageMatch[1]) })
            )
        );
    }

    const folderMatch = url.pathname.match(/^\/wiki\/folders\/(.+)$/u);
    if (request.method === 'DELETE' && folderMatch?.[1]) {
        const blockedResponse = requireWikiWrite(request, 'Wiki folder deletion');
        if (blockedResponse) {
            return blockedResponse;
        }
        return json(
            wikiPathMutationResultSchema.parse(
                await deleteWikiFolder({ path: decodeURIComponent(folderMatch[1]) })
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

/** Wiki content writes need a Tavern caller. Settings stay editable. */
function requireWikiWrite(request: Request, label: string) {
    const forbiddenResponse = requireTavernMutation(request, label);
    if (forbiddenResponse) {
        return forbiddenResponse;
    }
    return null;
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
