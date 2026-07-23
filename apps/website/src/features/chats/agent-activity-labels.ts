import type { AgentActivityOutput } from '../../lib/trpc.tsx';

export type AgentActivityEntry = AgentActivityOutput['entries'][number];

// The entry catalog (specs/agent-activity.md) is the rendering contract:
// these label shapes are pinned by agent-activity-labels.test.ts. Change
// the spec table and this module together, never one without the other.
// Entries carry no chat anchor (specs/presence.md); labels describe the
// turn itself, not where it happened.
export function formatAgentActivityEntry(entry: AgentActivityEntry) {
    switch (entry.kind) {
        case 'completed':
            return `Replied${entry.detail ? ` — ${entry.detail}` : ''}`;
        case 'failed':
            return 'Turn failed';
        case 'message_received':
            return `Message received${entry.detail ? ` — from ${entry.detail}` : ''}`;
        case 'new_session':
            return `Started fresh session${entry.detail ? ` — ${entry.detail}` : ''}`;
        case 'stopped':
            return 'Stopped';
        default:
            return entry.kind satisfies never;
    }
}

/** Wall-clock stamp: time today, short date + time otherwise. */
export function formatAgentActivityTime(at: string, now = new Date()) {
    const date = new Date(at);
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return date.toDateString() === now.toDateString()
        ? time
        : `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}
