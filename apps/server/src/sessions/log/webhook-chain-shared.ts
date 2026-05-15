import type { SessionLogPage } from '../contracts.ts';

export type SortableSessionLogEntry = SessionLogPage['entries'][number] & { order: number };

export function getTimestampValue(timestamp: string | null) {
    if (!timestamp) {
        return Number.POSITIVE_INFINITY;
    }

    const parsedValue = Date.parse(timestamp);
    return Number.isNaN(parsedValue) ? Number.POSITIVE_INFINITY : parsedValue;
}

export function extractWebhookUidFromContent(content: string) {
    const match = /webhookUid:\s*([0-9a-f-]{36})/i.exec(content);
    return match?.[1] ?? null;
}
