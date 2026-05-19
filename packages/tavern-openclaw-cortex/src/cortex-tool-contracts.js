export const CORTEX_PAGE_TYPES = [
    'agent',
    'chat',
    'decision',
    'fact',
    'file',
    'note',
    'person',
    'project',
    'source',
    'task',
];

export const CORTEX_JOB_NAMES = ['ingest', 'recall-index', 'lint', 'repair', 'export', 'health'];

export const TAVERN_CORTEX_TOOL_NAMES = [
    'cortex.search',
    'cortex.getPage',
    'cortex.capture',
    'cortex.recall',
    'cortex.status',
    'cortex.listBacklinks',
    'cortex.runJob',
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
