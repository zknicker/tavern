export function formatOptionalTimestamp(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value)
        ? new Date(value).toISOString()
        : undefined;
}

export function formatTimestamp(value: number | null | undefined) {
    return formatOptionalTimestamp(value) ?? 'unknown';
}

export function normalizeTimestamp(value: string | number | null | undefined, fallback: string) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toISOString();
    }

    return fallback;
}

export function getLatestTimestamp(current: null | string, next: string) {
    if (!current) {
        return next;
    }

    return current > next ? current : next;
}
