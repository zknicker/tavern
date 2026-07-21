export class AgentApiError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly status: number,
        readonly nextAction?: string
    ) {
        super(message);
        this.name = 'AgentApiError';
    }
}

export function targetNotFound(message: string): AgentApiError {
    return new AgentApiError(
        'TARGET_NOT_FOUND',
        message,
        404,
        'Use grotto server info --channels or --agents to inspect available handles.'
    );
}
