import type { AgentActivityOutput } from '../../lib/trpc.tsx';

export type AgentActivityEntry = AgentActivityOutput['entries'][number];

// The entry catalog (specs/agent-activity.md) is the rendering contract:
// these label shapes are pinned by agent-activity-labels.test.ts. Change
// the spec table and this module together, never one without the other.
export function formatAgentActivityEntry(entry: AgentActivityEntry) {
    const chat = entry.chatTitle ?? entry.chatId ?? 'a chat';
    switch (entry.kind) {
        case 'automation_fired':
            return `Automation fired${entry.detail ? `: ${entry.detail}` : ''} — in ${chat}`;
        case 'declined':
            return `Chose not to reply in ${chat}`;
        case 'failed':
            return `Turn failed in ${chat}`;
        case 'message_received':
            return `Message received in ${chat}${entry.detail ? ` — from ${entry.detail}` : ''}`;
        case 'new_session':
            return `Started fresh session${entry.detail ? ` — ${entry.detail}` : ''}`;
        case 'replied':
            return `Replied in ${chat}`;
        case 'stopped':
            return `Stopped in ${chat}`;
        case 'task_dispatched':
            return `Task dispatched${entry.detail ? `: ${entry.detail}` : ''}`;
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
