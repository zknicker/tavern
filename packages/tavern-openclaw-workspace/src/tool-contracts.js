export const TAVERN_WORKSPACE_TOOL_NAMES = ['workspace.notes.read', 'workspace.notes.update'];

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
