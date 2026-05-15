export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveToolValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        const items = value
            .map((item) => resolveToolValue(item))
            .filter((item): item is string => item !== null);

        return items.length > 0 ? items.join(', ') : null;
    }

    if (isRecord(value)) {
        const entries = Object.entries(value)
            .slice(0, 2)
            .map(([key, entryValue]) => {
                const formattedValue = resolveToolValue(entryValue);
                return formattedValue ? `${key}: ${formattedValue}` : null;
            })
            .filter((entry): entry is string => entry !== null);

        return entries.length > 0 ? entries.join(' · ') : null;
    }

    return null;
}

export function getString(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function getStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((item) => getString(item)).filter((item): item is string => item !== null);
}

export function getNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function formatCountLabel(count: number | null, singular: string, plural = `${singular}s`) {
    if (count === null || count < 0) {
        return null;
    }

    return `${count} ${count === 1 ? singular : plural}`;
}

export function parseJsonRecord(value: unknown) {
    const text = getString(value);

    if (!(text && (text.startsWith('{') || text.startsWith('[')))) {
        return null;
    }

    try {
        const parsed = JSON.parse(text) as unknown;
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function summarizeText(value: string | null, maxLength = 32) {
    if (!value) {
        return null;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
