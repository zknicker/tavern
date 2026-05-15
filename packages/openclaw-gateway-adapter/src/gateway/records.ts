export function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function readString(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

export function readText(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return null;
}

export function requireString(
    record: Record<string, unknown>,
    keys: string[],
    context: string
): string {
    const value = readString(record, keys);

    if (!value) {
        throw new Error(`${context} is missing required field ${keys.join('/')}.`);
    }

    return value;
}

export function requireText(
    record: Record<string, unknown>,
    keys: string[],
    context: string
): string {
    const value = readText(record, keys);

    if (value === null) {
        throw new Error(`${context} is missing required field ${keys.join('/')}.`);
    }

    return value;
}

export function readBoolean(record: Record<string, unknown>, keys: string[], fallback = false) {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'boolean') {
            return value;
        }
    }

    return fallback;
}

export function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
        const value = record[key];

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }

    return null;
}

export function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

export function readRecordArray(
    record: Record<string, unknown>,
    keys: string[]
): Record<string, unknown>[] {
    for (const key of keys) {
        const value = record[key];

        if (Array.isArray(value)) {
            return value.map(asRecord);
        }
    }

    return [];
}

export function nowIso() {
    return new Date().toISOString();
}

export function toIsoString(value: unknown): string | null {
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.valueOf()) ? null : date.toISOString();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value);
        return Number.isNaN(date.valueOf()) ? null : date.toISOString();
    }

    return null;
}

export function requireIsoString(value: unknown, context: string): string {
    const iso = toIsoString(value);

    if (!iso) {
        throw new Error(`${context} is missing a valid timestamp.`);
    }

    return iso;
}
