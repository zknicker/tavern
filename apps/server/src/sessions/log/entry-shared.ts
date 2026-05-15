import type {
    SessionAccessEvent,
    SessionArtifact,
    SessionDelivery,
    SessionLogPage,
    SessionMessage,
    SessionThinking,
} from '../contracts.ts';

export type SessionLogEntry = SessionLogPage['entries'][number];
export type SortableSessionLogEntry = SessionLogEntry & { order: number };

export interface SessionLogEntryInput {
    accessEvents?: SessionAccessEvent[];
    artifacts?: SessionArtifact[];
    deliveries: SessionDelivery[];
    messages: SessionMessage[];
    thinking?: SessionThinking[];
}

export function getTimestampValue(timestamp: string | null) {
    if (!timestamp) {
        return Number.POSITIVE_INFINITY;
    }

    const parsedValue = Date.parse(timestamp);
    return Number.isNaN(parsedValue) ? Number.POSITIVE_INFINITY : parsedValue;
}
