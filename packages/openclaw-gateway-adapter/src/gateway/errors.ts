export class OpenClawGatewayError extends Error {
    readonly code: string;
    readonly details: unknown;
    readonly retryAfterMs: number | null;
    readonly retryable: boolean;

    constructor(input: {
        code: string;
        details?: unknown;
        message: string;
        retryAfterMs?: number | null;
        retryable?: boolean;
    }) {
        super(input.message);
        this.name = 'OpenClawGatewayError';
        this.code = input.code;
        this.details = input.details;
        this.retryAfterMs = input.retryAfterMs ?? null;
        this.retryable = input.retryable ?? false;
    }
}

export class OpenClawUnsupportedError extends OpenClawGatewayError {
    constructor(message: string) {
        super({
            code: 'unsupported_openclaw_surface',
            message,
            retryable: false,
        });
        this.name = 'OpenClawUnsupportedError';
    }
}

export function toOpenClawGatewayError(error: unknown): OpenClawGatewayError {
    if (error instanceof OpenClawGatewayError) {
        return error;
    }

    if (error instanceof Error) {
        return new OpenClawGatewayError({
            code: 'openclaw_gateway_error',
            message: error.message,
            retryable: false,
        });
    }

    return new OpenClawGatewayError({
        code: 'openclaw_gateway_error',
        message: 'OpenClaw Gateway request failed.',
        retryable: false,
    });
}
