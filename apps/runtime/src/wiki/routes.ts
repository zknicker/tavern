import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveWikiSettingsResultSchema,
    agentRuntimeSaveWikiSettingsSchema,
    agentRuntimeWikiSettingsSchema,
    wikiAttachmentContentSchema,
    wikiAttachmentSchema,
    wikiBacklinkListSchema,
    wikiCreatePageSchema,
    wikiMovePathSchema,
    wikiPageHistorySchema,
    wikiPageListSchema,
    wikiPageRevisionSchema,
    wikiPageSchema,
    wikiPathInputSchema,
    wikiPathMutationResultSchema,
    wikiSavePageSchema,
    wikiSearchInputSchema,
    wikiSearchResultSchema,
    wikiStatusSchema,
    wikiUploadAttachmentSchema,
} from '@tavern/api';
import { signalAgentSettingsApplied } from '../agent-engine/settings-apply';
import { conflict, forbidden, json, notFound } from '../tavern/http';
import { getWikiPageHistory, getWikiPageRevision } from './page-history';
import {
    createWikiFolder,
    createWikiPage,
    deleteWikiFolder,
    deleteWikiPage,
    getWikiAttachment,
    getWikiPage,
    getWikiSettings,
    getWikiStatus,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    saveWikiPage,
    saveWikiSettings,
    searchWiki,
    uploadWikiAttachment,
    WikiPageConflictError,
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

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.wikiAttachments) {
        const blockedResponse = requireWikiWrite(request, 'Wiki image uploads');
        if (blockedResponse) {
            return blockedResponse;
        }
        const input = wikiUploadAttachmentSchema.parse(await readJson(request));
        return json(wikiAttachmentSchema.parse(await uploadWikiAttachment(input)));
    }

    const attachmentMatch = url.pathname.match(/^\/wiki\/attachments\/(.+)$/u);
    if (request.method === 'GET' && attachmentMatch?.[1]) {
        const attachment = await getWikiAttachment({
            path: decodeURIComponent(attachmentMatch[1]),
        });
        return attachment ? json(wikiAttachmentContentSchema.parse(attachment)) : notFound();
    }

    const revisionMatch = url.pathname.match(/^\/wiki\/pages\/(.+)\/history\/([^/]+)$/u);
    if (request.method === 'GET' && revisionMatch?.[1] && revisionMatch[2]) {
        return json(
            wikiPageRevisionSchema.parse(
                await getWikiPageRevision({
                    commit: decodeURIComponent(revisionMatch[2]),
                    path: decodeURIComponent(revisionMatch[1]),
                })
            )
        );
    }

    const historyMatch = url.pathname.match(/^\/wiki\/pages\/(.+)\/history$/u);
    if (request.method === 'GET' && historyMatch?.[1]) {
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number(limitParam) : undefined;
        return json(
            wikiPageHistorySchema.parse(
                await getWikiPageHistory({
                    limit: Number.isFinite(limit) ? limit : undefined,
                    path: decodeURIComponent(historyMatch[1]),
                })
            )
        );
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
        try {
            return json(wikiPathMutationResultSchema.parse(await saveWikiPage(input)));
        } catch (error) {
            if (error instanceof WikiPageConflictError) {
                return conflict(error.message);
            }
            throw error;
        }
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
    return forbidden(`${label} requires a Grotto caller.`);
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
