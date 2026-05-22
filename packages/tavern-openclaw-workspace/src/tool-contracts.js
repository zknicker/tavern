export const TAVERN_WORKSPACE_TOOL_NAMES = ['workspace_notes_read', 'workspace_notes_update'];

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

export function optionalStringSchema(description) {
    return {
        description,
        type: ['string', 'null'],
    };
}
