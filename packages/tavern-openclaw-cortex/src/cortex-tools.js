import {
    arraySchema,
    CORTEX_IMPORT_KINDS,
    CORTEX_INGEST_KINDS,
    CORTEX_PAGE_TYPES,
    CORTEX_RECALL_MODES,
    enumSchema,
    integerSchema,
    nullableStringSchema,
    objectSchema,
    recordSchema,
    stringSchema,
} from './cortex-tool-contracts.js';

export { TAVERN_CORTEX_TOOL_NAMES } from './cortex-tool-contracts.js';

export function registerTavernCortexTools(api, options = {}) {
    if (typeof api?.registerTool !== 'function') {
        throw new Error('Tavern Cortex tools require OpenClaw tool registration.');
    }

    const request = createCortexRequest(options);

    api.registerTool({
        name: 'cortex_search',
        description: 'Search Tavern Cortex wiki pages by text and embeddings.',
        parameters: objectSchema({
            limit: integerSchema({
                description: 'Maximum number of pages to return.',
                maximum: 50,
            }),
            query: stringSchema('Search query.'),
            scope: contextScopeSchema(),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/search', { body: searchParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_get_page',
        description: 'Read a Tavern Cortex wiki page by id, slug, alias, or wiki link target.',
        parameters: objectSchema({
            target: stringSchema('Page id, slug, alias, or wiki link target.'),
        }),
        async execute(_toolCallId, params, signal) {
            const target = requireString(params?.target, 'target');
            return toolJson(
                await request(`/cortex/pages/${encodeURIComponent(target)}`, { signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_capture',
        description:
            'Capture a durable note, fact, decision, source, or memory into Tavern Cortex.',
        parameters: objectSchema({
            actorId: stringSchema('Actor id to record as the capture source.'),
            actorKind: enumSchema(['agent', 'runtime', 'system', 'user'], 'Capture actor kind.'),
            agentId: nullableStringSchema('Owning agent scope id.'),
            chatId: nullableStringSchema('Related Tavern chat id.'),
            content: stringSchema('Markdown content to save.'),
            fileId: nullableStringSchema('Related file id.'),
            messageId: nullableStringSchema('Related message id.'),
            participantId: nullableStringSchema('Subject participant scope id.'),
            profileId: nullableStringSchema('Subject profile scope id.'),
            sessionKey: nullableStringSchema('Related runtime session key.'),
            tags: arraySchema(stringSchema('Tag.'), 'Tags to store in page frontmatter.'),
            title: stringSchema('Cortex page title.'),
            turnId: nullableStringSchema('Related runtime turn id.'),
            type: stringSchema(`Cortex page type. Default types: ${CORTEX_PAGE_TYPES.join(', ')}.`),
            url: nullableStringSchema('Related source URL.'),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/capture', { body: captureParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_edit',
        description:
            'Edit Cortex pages by upserting, archiving, deleting, merging, splitting, or recording a noop.',
        parameters: objectSchema({
            action: enumSchema(
                ['upsert', 'archive', 'delete', 'merge', 'split', 'noop'],
                'Edit action.'
            ),
            actorId: stringSchema('Actor id to record as the edit source.'),
            actorKind: enumSchema(['agent', 'runtime', 'system', 'user'], 'Edit actor kind.'),
            agentId: nullableStringSchema('Owning agent scope id.'),
            aliases: arraySchema(stringSchema('Alias.'), 'Page aliases for upsert.'),
            body: nullableStringSchema('Full page body markdown for upsert.'),
            chatId: nullableStringSchema('Related Tavern chat id.'),
            claims: arraySchema(recordSchema('Claim.'), 'Structured page claims for upsert.'),
            compiledTruth: nullableStringSchema('Compiled truth markdown for upsert.'),
            fileId: nullableStringSchema('Related file id.'),
            frontmatter: recordSchema('Extra page frontmatter for upsert.'),
            links: arraySchema(recordSchema('Link.'), 'Page links for upsert.'),
            messageId: nullableStringSchema('Related message id.'),
            pages: arraySchema(recordSchema('Split page.'), 'Pages to create for split.'),
            participantId: nullableStringSchema('Subject participant scope id.'),
            profileId: nullableStringSchema('Subject profile scope id.'),
            reason: nullableStringSchema('Noop reason.'),
            sessionKey: nullableStringSchema('Related runtime session key.'),
            slug: nullableStringSchema('Optional slug for upsert.'),
            slugOrId: nullableStringSchema('Target page slug or id for archive/delete.'),
            sourceSlugOrId: nullableStringSchema('Source page slug or id for merge/split.'),
            status: nullableStringSchema('Page status for upsert.'),
            summary: nullableStringSchema('Audit summary for the edit.'),
            tags: arraySchema(stringSchema('Tag.'), 'Tags to store in page frontmatter.'),
            targetSlugOrId: nullableStringSchema('Target page slug or id for merge.'),
            timelineEntries: arraySchema(
                recordSchema('Timeline entry.'),
                'Timeline entries for upsert.'
            ),
            title: nullableStringSchema('Page title for upsert.'),
            turnId: nullableStringSchema('Related runtime turn id.'),
            type: stringSchema(`Cortex page type. Default types: ${CORTEX_PAGE_TYPES.join(', ')}.`),
            url: nullableStringSchema('Related source URL.'),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/edit', { body: editParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_ingest',
        description:
            'Register normalized source-backed text, transcripts, links, articles, or media extracts into Tavern Cortex.',
        parameters: objectSchema({
            actorId: nullableStringSchema('Actor id to record as the ingest source.'),
            actorKind: enumSchema(['agent', 'runtime', 'system', 'user'], 'Ingest actor kind.'),
            agentId: nullableStringSchema('Owning agent scope id.'),
            chatId: nullableStringSchema('Related Tavern chat id.'),
            content: stringSchema('Normalized source text, transcript, article text, or notes.'),
            fileId: nullableStringSchema('Related file id.'),
            kind: stringSchema(`Source kind. Common kinds: ${CORTEX_INGEST_KINDS.join(', ')}.`),
            locator: nullableStringSchema('Stable source locator such as URL, file path, or id.'),
            messageId: nullableStringSchema('Related message id.'),
            metadata: recordSchema(
                'Source metadata such as author, publishedAt, format, or title.'
            ),
            participantId: nullableStringSchema('Subject participant scope id.'),
            profileId: nullableStringSchema('Subject profile scope id.'),
            sessionKey: nullableStringSchema('Related runtime session key.'),
            tags: arraySchema(stringSchema('Tag.'), 'Tags to store in page frontmatter.'),
            title: nullableStringSchema('Cortex source page title.'),
            turnId: nullableStringSchema('Related runtime turn id.'),
            type: stringSchema(`Cortex page type. Default types: ${CORTEX_PAGE_TYPES.join(', ')}.`),
            url: nullableStringSchema('Related source URL.'),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/ingest', { body: ingestParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_import',
        description:
            'Import articles, posts, documents, PDFs, books, transcripts, media, images, screenshots, or repos into Tavern Cortex.',
        parameters: objectSchema({
            actorId: nullableStringSchema('Actor id to record as the import source.'),
            actorKind: enumSchema(['agent', 'runtime', 'system', 'user'], 'Import actor kind.'),
            agentId: nullableStringSchema('Owning agent scope id.'),
            chatId: nullableStringSchema('Related Tavern chat id.'),
            content: nullableStringSchema('Already extracted text or transcript.'),
            fileId: nullableStringSchema('Related file id.'),
            kind: enumSchema(CORTEX_IMPORT_KINDS, 'Import kind.'),
            locator: nullableStringSchema('Stable source locator such as URL, file path, or id.'),
            mediaType: nullableStringSchema('Source media type such as text/html or audio/mpeg.'),
            messageId: nullableStringSchema('Related message id.'),
            metadata: recordSchema('Source metadata such as author, title, provider, or format.'),
            participantId: nullableStringSchema('Subject participant scope id.'),
            profileId: nullableStringSchema('Subject profile scope id.'),
            rawContentBase64: nullableStringSchema('Optional raw source bytes encoded as base64.'),
            rawFileName: nullableStringSchema('Optional raw source filename.'),
            sessionKey: nullableStringSchema('Related runtime session key.'),
            tags: arraySchema(stringSchema('Tag.'), 'Tags to store in page frontmatter.'),
            title: nullableStringSchema('Cortex source page title.'),
            turnId: nullableStringSchema('Related runtime turn id.'),
            type: stringSchema(`Cortex page type. Default types: ${CORTEX_PAGE_TYPES.join(', ')}.`),
            url: nullableStringSchema('Related source URL.'),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/import', { body: importParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_recall',
        description:
            'Recall grounded long-term context from Tavern Cortex and write a recall audit event.',
        parameters: objectSchema({
            limit: integerSchema({
                description: 'Maximum number of pages to return.',
                maximum: 50,
            }),
            mode: enumSchema(CORTEX_RECALL_MODES, 'Recall budget mode.'),
            query: stringSchema('Recall query.'),
            scope: contextScopeSchema(),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/recall', { body: recallParams(params), signal })
            );
        },
    });

    api.registerTool({
        name: 'cortex_list_backlinks',
        description: 'List Cortex wiki links pointing at a page or unresolved wiki target.',
        parameters: objectSchema({
            target: stringSchema('Page id, slug, alias, or unresolved wiki target.'),
        }),
        async execute(_toolCallId, params, signal) {
            const target = requireString(params?.target, 'target');
            return toolJson(
                await request(`/cortex/pages/${encodeURIComponent(target)}/backlinks`, { signal })
            );
        },
    });
}

function createCortexRequest(options) {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.TAVERN_API_BASE_URL);
    const fetchImpl = options.fetch ?? globalThis.fetch;

    if (!baseUrl) {
        throw new Error('TAVERN_API_BASE_URL is required for Tavern Cortex tools.');
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch is required for Tavern Cortex tools.');
    }

    return async (path, input = {}) => {
        const response = await fetchImpl(`${baseUrl}${path}`, {
            body: input.body ? JSON.stringify(input.body) : undefined,
            headers: input.body ? { 'content-type': 'application/json' } : undefined,
            method: input.method ?? (input.body ? 'POST' : 'GET'),
            signal: input.signal,
        });

        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        if (!response.ok) {
            throw new Error(
                `Tavern Cortex request failed (${response.status}): ${formatErrorBody(body)}`
            );
        }

        return body;
    };
}

function captureParams(params = {}) {
    return {
        content: requireString(params.content, 'content'),
        source: {
            actorId: optionalString(params.actorId) ?? 'openclaw-agent',
            actorKind: optionalString(params.actorKind) ?? 'agent',
            agentId: optionalString(params.agentId),
            chatId: optionalString(params.chatId),
            fileId: optionalString(params.fileId),
            messageId: optionalString(params.messageId),
            participantId: optionalString(params.participantId),
            profileId: optionalString(params.profileId),
            sessionKey: optionalString(params.sessionKey),
            turnId: optionalString(params.turnId),
            url: optionalString(params.url),
        },
        tags: Array.isArray(params.tags)
            ? params.tags.filter((tag) => typeof tag === 'string')
            : [],
        title: requireString(params.title, 'title'),
        type: optionalString(params.type) ?? 'note',
    };
}

function ingestParams(params = {}) {
    const actor = {
        actorId: optionalString(params.actorId) ?? 'openclaw-agent',
        actorKind: optionalString(params.actorKind) ?? 'agent',
        agentId: optionalString(params.agentId),
        chatId: optionalString(params.chatId),
        fileId: optionalString(params.fileId),
        messageId: optionalString(params.messageId),
        participantId: optionalString(params.participantId),
        profileId: optionalString(params.profileId),
        sessionKey: optionalString(params.sessionKey),
        turnId: optionalString(params.turnId),
        url: optionalString(params.url),
    };

    return {
        actor,
        content: requireString(params.content, 'content'),
        kind: optionalString(params.kind) ?? 'source',
        locator: optionalString(params.locator) ?? optionalString(params.url),
        metadata: plainRecord(params.metadata),
        tags: Array.isArray(params.tags)
            ? params.tags.filter((tag) => typeof tag === 'string')
            : [],
        title: optionalString(params.title),
        type: optionalString(params.type) ?? 'source',
    };
}

function importParams(params = {}) {
    return {
        actor: {
            actorId: optionalString(params.actorId) ?? 'openclaw-agent',
            actorKind: optionalString(params.actorKind) ?? 'agent',
            agentId: optionalString(params.agentId),
            chatId: optionalString(params.chatId),
            fileId: optionalString(params.fileId),
            messageId: optionalString(params.messageId),
            participantId: optionalString(params.participantId),
            profileId: optionalString(params.profileId),
            sessionKey: optionalString(params.sessionKey),
            turnId: optionalString(params.turnId),
            url: optionalString(params.url),
        },
        content: optionalString(params.content),
        kind: optionalString(params.kind) ?? 'article',
        locator: optionalString(params.locator) ?? optionalString(params.url),
        mediaType: optionalString(params.mediaType),
        metadata: plainRecord(params.metadata),
        rawContentBase64: optionalString(params.rawContentBase64),
        rawFileName: optionalString(params.rawFileName),
        tags: Array.isArray(params.tags)
            ? params.tags.filter((tag) => typeof tag === 'string')
            : [],
        title: optionalString(params.title),
        type: optionalString(params.type),
    };
}

function editParams(params = {}) {
    const action = requireString(params.action, 'action');
    const body = {
        action,
        source: {
            actorId: optionalString(params.actorId) ?? 'openclaw-agent',
            actorKind: optionalString(params.actorKind) ?? 'agent',
            agentId: optionalString(params.agentId),
            chatId: optionalString(params.chatId),
            fileId: optionalString(params.fileId),
            messageId: optionalString(params.messageId),
            participantId: optionalString(params.participantId),
            profileId: optionalString(params.profileId),
            sessionKey: optionalString(params.sessionKey),
            turnId: optionalString(params.turnId),
            url: optionalString(params.url),
        },
        summary: optionalString(params.summary),
    };

    if (action === 'upsert') {
        return stripUndefined({
            ...body,
            aliases: stringArray(params.aliases),
            body: optionalString(params.body),
            claims: recordArray(params.claims),
            compiledTruth: optionalString(params.compiledTruth),
            frontmatter: plainRecord(params.frontmatter),
            links: recordArray(params.links),
            slug: optionalString(params.slug),
            status: optionalString(params.status),
            tags: stringArray(params.tags),
            timelineEntries: recordArray(params.timelineEntries),
            title: requireString(params.title, 'title'),
            type: optionalString(params.type) ?? 'note',
        });
    }

    if (action === 'archive' || action === 'delete') {
        return stripUndefined({
            ...body,
            slugOrId: requireString(params.slugOrId, 'slugOrId'),
        });
    }

    if (action === 'merge') {
        return stripUndefined({
            ...body,
            sourceSlugOrId: requireString(params.sourceSlugOrId, 'sourceSlugOrId'),
            targetSlugOrId: requireString(params.targetSlugOrId, 'targetSlugOrId'),
        });
    }

    if (action === 'split') {
        return stripUndefined({
            ...body,
            pages: recordArray(params.pages),
            sourceSlugOrId: requireString(params.sourceSlugOrId, 'sourceSlugOrId'),
        });
    }

    if (action === 'noop') {
        return stripUndefined({
            ...body,
            reason: requireString(params.reason, 'reason'),
        });
    }

    throw new Error(`Unsupported Cortex edit action: ${action}`);
}

function searchParams(params = {}) {
    return {
        limit: clampLimit(params.limit),
        query: requireString(params.query, 'query'),
        scope: contextScope(params.scope),
    };
}

function recallParams(params = {}) {
    return {
        ...searchParams(params),
        mode: CORTEX_RECALL_MODES.includes(params.mode) ? params.mode : undefined,
    };
}

function contextScopeSchema() {
    return objectSchema({
        agentId: nullableStringSchema('Owning agent scope id.'),
        chatId: nullableStringSchema('Active chat scope id.'),
        participantId: nullableStringSchema('Active participant scope id.'),
        profileId: nullableStringSchema('Active profile scope id.'),
    });
}

function contextScope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const scope = {
        agentId: optionalString(value.agentId),
        chatId: optionalString(value.chatId),
        participantId: optionalString(value.participantId),
        profileId: optionalString(value.profileId),
    };

    return Object.values(scope).some(Boolean) ? scope : undefined;
}

function clampLimit(value) {
    if (!Number.isInteger(value)) {
        return 10;
    }

    return Math.min(Math.max(value, 1), 50);
}

function requireString(value, name) {
    const text = optionalString(value);
    if (!text) {
        throw new Error(`${name} is required.`);
    }

    return text;
}

function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function plainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    );
}

function recordArray(value) {
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : [];
}

function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
        : [];
}

function stripUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function toolJson(value) {
    return {
        content: [
            {
                text: JSON.stringify(value, null, 2),
                type: 'text',
            },
        ],
    };
}

function normalizeBaseUrl(value) {
    return typeof value === 'string' && value.trim() ? value.trim().replace(/\/$/u, '') : null;
}

function formatErrorBody(body) {
    if (!body) {
        return 'empty response';
    }

    if (typeof body === 'string') {
        return body;
    }

    return JSON.stringify(body);
}
