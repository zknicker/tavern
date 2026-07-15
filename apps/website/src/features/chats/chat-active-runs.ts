// Every live run the user can act on (stop): active turns plus streaming
// replies that have not completed.
export function getActiveRunIds(timeline: {
    activeReplies: readonly { completedAt?: string | null; runId: string }[];
    activeTurns: readonly { runId: string }[];
}) {
    const runIds = new Set<string>();

    for (const turn of timeline.activeTurns) {
        runIds.add(turn.runId);
    }

    for (const reply of timeline.activeReplies) {
        if (!reply.completedAt) {
            runIds.add(reply.runId);
        }
    }

    return [...runIds];
}
