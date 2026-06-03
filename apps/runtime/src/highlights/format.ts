export function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatAgo(now: Date, timestamp: string) {
    const diffMs = Math.max(0, now.getTime() - Date.parse(timestamp));
    const minutes = Math.max(1, Math.round(diffMs / 60_000));

    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function truncateReceipt(value: string) {
    const trimmed = value.trim().replace(/\s+/gu, ' ');

    if (trimmed.length <= 90) {
        return trimmed;
    }

    return `${trimmed.slice(0, 87).trim()}...`;
}
