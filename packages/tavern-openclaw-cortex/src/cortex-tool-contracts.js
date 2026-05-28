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

export const TAVERN_CORTEX_TOOL_NAMES = [
    'cortex_search',
    'cortex_get_page',
    'cortex_capture',
    'cortex_recall',
    'cortex_list_backlinks',
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
