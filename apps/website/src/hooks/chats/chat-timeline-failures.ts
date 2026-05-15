import type { ChatTimeline } from './chat-timeline-state.ts';

export function hasLoggedTurnFailure(rows: ChatTimeline, runId: string) {
    return rows.some((row) => {
        if (row.kind !== 'message' || row.message.senderType !== 'system') {
            return false;
        }

        const metadata = row.message.metadata as
            | { tavern?: { turnFailure?: { runId?: unknown } } }
            | null
            | undefined;

        return metadata?.tavern?.turnFailure?.runId === runId;
    });
}
