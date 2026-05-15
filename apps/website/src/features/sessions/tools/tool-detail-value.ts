export function formatDetailValue(value: unknown) {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'undefined' || value === null) {
        return null;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function parseJsonValue(value: unknown): object | null {
    if (typeof value === 'object' && value !== null) {
        return value as object;
    }

    if (typeof value !== 'string') {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        return typeof parsed === 'object' && parsed !== null ? (parsed as object) : null;
    } catch {
        return null;
    }
}

export function parseToolRecord(value: unknown): Record<string, unknown> | null {
    const parsed = parseJsonValue(value);
    return parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}
