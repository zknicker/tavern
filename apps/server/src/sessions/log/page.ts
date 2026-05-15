import { sessionLogPageSchema } from '../contracts.ts';
import { buildSessionLogEntries } from './entries.ts';

function parseOffset(input: { offset: number; total: number }) {
    return Math.min(input.offset, input.total);
}

export function buildSessionLogPage(
    input: Parameters<typeof buildSessionLogEntries>[0] & {
        limit: number;
        offset: number;
    }
) {
    const entries = buildSessionLogEntries(input);
    const total = entries.length;
    const offset = parseOffset({
        offset: input.offset,
        total,
    });

    return sessionLogPageSchema.parse({
        entries: entries.slice(offset, offset + input.limit).map(({ order, ...entry }) => entry),
        limit: input.limit,
        offset,
        total,
    });
}

export function buildRecentSessionLogPage(
    input: Parameters<typeof buildSessionLogEntries>[0] & { limit: number }
) {
    const entries = buildSessionLogEntries(input);
    const total = entries.length;
    const offset = Math.max(total - input.limit, 0);

    return sessionLogPageSchema.parse({
        entries: entries.slice(offset).map(({ order, ...entry }) => entry),
        limit: input.limit,
        offset,
        total,
    });
}
