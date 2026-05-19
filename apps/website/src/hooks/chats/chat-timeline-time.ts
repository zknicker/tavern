export function getTimestampMs(timestamp: string) {
    const parsed = Date.parse(timestamp);

    return Number.isNaN(parsed) ? null : parsed;
}
