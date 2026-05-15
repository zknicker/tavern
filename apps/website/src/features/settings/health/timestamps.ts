export function getAgeMs(value: string | null, now: number) {
    const timestampMs = toTimestampMs(value);
    if (timestampMs === null) {
        return null;
    }

    const age = now - timestampMs;
    return Number.isFinite(age) ? age : null;
}

export function toTimestampMs(value: string | null) {
    if (!value) {
        return null;
    }

    const timestampMs = new Date(value).getTime();
    return Number.isFinite(timestampMs) ? timestampMs : null;
}
