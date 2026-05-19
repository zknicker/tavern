import { getTimestampMs } from './chat-timeline-time.ts';
import type { ChatTimeline, ChatTurn } from './chat-timeline-types.ts';

export function hasDurableActivityForTurn(
    rows: ChatTimeline,
    turn: Pick<ChatTurn, 'sessionKey' | 'startedAt'>
) {
    const startedAt = getTimestampMs(turn.startedAt);
    const sessionKey = turn.sessionKey.trim();

    return rows.some((row) => {
        if (row.kind !== 'system' && row.kind !== 'tool') {
            return false;
        }

        const rowSessionKey = row.kind === 'tool' ? row.sessionKey : null;
        const normalizedRowSessionKey = rowSessionKey?.trim() ?? '';

        if (sessionKey && normalizedRowSessionKey && normalizedRowSessionKey !== sessionKey) {
            return false;
        }

        const timestamp =
            row.kind === 'system'
                ? getTimestampMs(row.timestamp ?? '')
                : getTimestampMs(row.startedAt ?? row.completedAt ?? '');

        return timestamp === null || startedAt === null || timestamp >= startedAt;
    });
}
