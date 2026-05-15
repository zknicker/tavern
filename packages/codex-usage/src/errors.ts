export class CodexUsageAuthError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'CodexUsageAuthError';
    }
}

export class CodexUsageRequestError extends Error {
    public readonly status: number;

    public constructor(message: string, status: number) {
        super(message);
        this.name = 'CodexUsageRequestError';
        this.status = status;
    }
}

export class CodexUsageParseError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'CodexUsageParseError';
    }
}
