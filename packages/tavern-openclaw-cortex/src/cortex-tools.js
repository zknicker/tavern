import {
    arraySchema,
    CORTEX_PAGE_TYPES,
    enumSchema,
    integerSchema,
    nullableStringSchema,
    objectSchema,
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
            type: enumSchema(CORTEX_PAGE_TYPES, 'Cortex page type.'),
            url: nullableStringSchema('Related source URL.'),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/capture', { body: captureParams(params), signal })
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
            query: stringSchema('Recall query.'),
            scope: contextScopeSchema(),
        }),
        async execute(_toolCallId, params, signal) {
            return toolJson(
                await request('/cortex/recall', { body: searchParams(params), signal })
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

function searchParams(params = {}) {
    return {
        limit: clampLimit(params.limit),
        query: requireString(params.query, 'query'),
        scope: contextScope(params.scope),
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
