import type { SessionLogEntryInput, SortableSessionLogEntry } from './entry-shared.ts';
import { sortSessionLogEntries } from './entry-sort.ts';
import { buildMessageEntries } from './tool-executions.ts';

export function buildSessionLogEntries(input: SessionLogEntryInput) {
    const messageEntries = buildMessageEntries(input.messages);
    const entries: SortableSessionLogEntry[] = [
        ...messageEntries,
        ...input.deliveries.map((delivery, index) => ({
            delivery,
            id: delivery.id,
            kind: 'delivery' as const,
            order: input.messages.length + index,
            timestamp: delivery.deliveredAt,
        })),
        ...(input.thinking ?? []).map((thinking, index) => ({
            id: thinking.id,
            kind: 'thinking' as const,
            order: input.messages.length + input.deliveries.length + index,
            thinking,
            timestamp: thinking.timestamp,
        })),
        ...(input.accessEvents ?? []).map((accessEvent, index) => ({
            accessEvent,
            id: accessEvent.id,
            kind: 'accessEvent' as const,
            order:
                input.messages.length +
                input.deliveries.length +
                (input.thinking?.length ?? 0) +
                index,
            timestamp: accessEvent.occurredAt,
        })),
        ...(input.artifacts ?? []).map((artifact, index) => ({
            artifact,
            id: artifact.id,
            kind: 'artifact' as const,
            order:
                input.messages.length +
                input.deliveries.length +
                (input.thinking?.length ?? 0) +
                (input.accessEvents?.length ?? 0) +
                index,
            timestamp: artifact.createdAt,
        })),
    ];

    return sortSessionLogEntries(entries);
}
