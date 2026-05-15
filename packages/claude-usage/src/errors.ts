export class ClaudeUsageAuthError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ClaudeUsageAuthError';
    }
}

export class ClaudeUsageRequestError extends Error {
    public readonly status: number;

    public constructor(message: string, status: number) {
        super(message);
        this.name = 'ClaudeUsageRequestError';
        this.status = status;
    }
}

export class ClaudeUsageParseError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ClaudeUsageParseError';
    }
}
