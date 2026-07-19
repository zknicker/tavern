import type { AgentActivityOutput } from '../../lib/trpc.tsx';

type ActivityEntry = AgentActivityOutput['entries'][number];

export interface OverviewActivityItem {
    agentId: string;
    atMs: number;
    entry: ActivityEntry;
    key: string;
}

export interface OverviewActivityFeed {
    items: OverviewActivityItem[];
    /** Events per day, oldest→newest, over the trailing week — the card
        sparkline series. */
    seriesByAgentId: Map<string, number[]>;
}

const feedLimit = 20;
const sparklineDays = 7;
const dayMs = 24 * 60 * 60 * 1000;

// The workspace feed shows what agents *did*; inbound user messages are
// timeline noise here.
const feedKinds = new Set<ActivityEntry['kind']>([
    'automation_fired',
    'declined',
    'failed',
    'new_session',
    'replied',
    'stopped',
    'task_dispatched',
]);

export function buildOverviewActivityFeed(
    agents: Array<{ agentId: string; entries: ActivityEntry[] }>,
    now: number
): OverviewActivityFeed {
    const items: OverviewActivityItem[] = [];
    const seriesByAgentId = new Map<string, number[]>();

    for (const { agentId, entries } of agents) {
        const series = new Array<number>(sparklineDays).fill(0);

        for (const entry of entries) {
            const atMs = Date.parse(entry.at);

            if (Number.isNaN(atMs)) {
                continue;
            }

            const dayAgo = Math.floor((now - atMs) / dayMs);

            if (dayAgo >= 0 && dayAgo < sparklineDays) {
                const bucket = sparklineDays - 1 - dayAgo;
                series[bucket] = (series[bucket] ?? 0) + 1;
            }

            if (feedKinds.has(entry.kind)) {
                items.push({
                    agentId,
                    atMs,
                    entry,
                    key: `${agentId}:${entry.at}:${entry.kind}:${entry.turnId ?? ''}`,
                });
            }
        }

        seriesByAgentId.set(agentId, series);
    }

    items.sort((left, right) => right.atMs - left.atMs);

    return { items: items.slice(0, feedLimit), seriesByAgentId };
}

/** The clause between the agent chip and the chat chip: what the agent did,
    with `showsChat` telling the row whether to append "in <chat chip>". */
export function describeActivityEntry(entry: ActivityEntry): {
    clause: string;
    showsChat: boolean;
} {
    switch (entry.kind) {
        case 'automation_fired':
            return {
                clause: entry.detail ? `ran the ${entry.detail} automation` : 'ran an automation',
                showsChat: true,
            };
        case 'declined':
            return { clause: 'held back a reply', showsChat: true };
        case 'failed':
            return { clause: 'hit an error', showsChat: true };
        case 'message_received':
            return { clause: 'received a message', showsChat: true };
        case 'new_session':
            return { clause: 'started a fresh session', showsChat: false };
        case 'replied':
            return { clause: 'replied', showsChat: true };
        case 'stopped':
            return { clause: 'was stopped', showsChat: true };
        case 'task_dispatched':
            return {
                clause: entry.detail ? `picked up “${entry.detail}”` : 'picked up a task',
                showsChat: false,
            };
        default:
            return { clause: 'did something', showsChat: false };
    }
}
