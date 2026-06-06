export const CORTEX_PAGE_TYPES = [
    'person',
    'company',
    'project',
    'product',
    'brand',
    'campaign',
    'customer-segment',
    'niche',
    'listing',
    'design',
    'collection',
    'marketplace',
    'production-partner',
    'platform',
    'tool',
    'asset',
    'source',
    'content',
    'podcast',
    'x-post',
    'takeaway',
    'investment',
    'trade',
    'thesis',
    'event',
    'decision',
    'task',
    'reminder',
    'automation',
    'workflow',
    'agent',
    'metric',
    'fact',
    'preference',
    'idea',
    'note',
];

export const CORTEX_RECALL_MODES = ['conservative', 'balanced', 'tokenmax'];

export const TAVERN_CORTEX_TOOL_NAMES = [
    'cortex_search',
    'cortex_get_page',
    'cortex_capture',
    'cortex_edit',
    'cortex_ingest',
    'cortex_import',
    'cortex_recall',
    'cortex_list_backlinks',
];

export const CORTEX_IMPORT_KINDS = [
    'article',
    'audio',
    'book',
    'document',
    'image',
    'pdf',
    'podcast',
    'repo',
    'screenshot',
    'transcript',
    'video',
    'x-post',
];

export const CORTEX_INGEST_KINDS = [
    'article',
    'book',
    'document',
    'idea',
    'podcast',
    'repo',
    'source',
    'transcript',
    'video',
    'x-post',
];

export function objectSchema(properties) {
    return {
        additionalProperties: false,
        properties,
        type: 'object',
    };
}

export function stringSchema(description) {
    return {
        description,
        type: 'string',
    };
}

export function nullableStringSchema(description) {
    return {
        description,
        type: ['string', 'null'],
    };
}

export function integerSchema({ description, maximum }) {
    return {
        description,
        maximum,
        minimum: 1,
        type: 'integer',
    };
}

export function enumSchema(values, description) {
    return {
        description,
        enum: values,
        type: 'string',
    };
}

export function arraySchema(items, description) {
    return {
        description,
        items,
        type: 'array',
    };
}

export function recordSchema(description) {
    return {
        additionalProperties: true,
        description,
        type: 'object',
    };
}
