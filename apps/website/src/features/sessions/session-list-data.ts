import { formatRelativeTime } from '../../lib/format.ts';
import type { AgentListOutput, SessionListOutput } from '../../lib/trpc.tsx';

export type SessionPaneId = 'conversations' | 'cron';
export const sessionPaneLimit = 10;
export type SessionListItem = ReturnType<typeof buildSessionList>[number];

export interface SessionCardData {
    id: string;
    label: string;
    lastActivity: string;
    searchText: string;
    session: SessionListItem;
    source: string;
    type: SessionListItem['type'];
}

export function buildSessionList(
    agents: AgentListOutput['agents'],
    sessions: SessionListOutput['sessions'],
    now = Date.now()
) {
    return sessions.map((session) => {
        const agentName =
            agents.find((agent) => agent.id === session.agentId)?.name ?? session.agentId;

        return {
            agentId: session.agentId,
            agentName,
            id: session.id,
            key: session.key,
            lastActivity: formatRelativeTime(session.startedAt, now),
            messageCount: session.messageCount,
            name: session.name,
            searchText: [agentName, session.source, session.name].join('\n').toLowerCase(),
            source: session.source,
            startedAt: session.startedAt,
            type: session.type,
        };
    });
}

function compareSessions(a: SessionListItem, b: SessionListItem) {
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
}

function compareSessionCards(a: SessionCardData, b: SessionCardData) {
    return compareSessions(a.session, b.session);
}

export function buildSessionCards(sessions: SessionListItem[]): SessionCardData[] {
    return [...sessions].sort(compareSessions).map((session) => ({
        id: session.id,
        label: session.name,
        lastActivity: session.lastActivity,
        searchText: session.searchText,
        session,
        source: session.source,
        type: session.type,
    }));
}

export function getSessionPane(card: SessionCardData): SessionPaneId {
    switch (card.type) {
        case 'cron':
            return 'cron';
        default:
            return 'conversations';
    }
}

export function groupSessionCards(cards: SessionCardData[]) {
    return groupSessionCardsWithOptions(cards, {});
}

function limitSessionPane(input: {
    cards: SessionCardData[];
    focusedSessionKey?: string | null;
    limit: number;
}) {
    const sortedCards = [...input.cards].sort(compareSessionCards);
    const limitedCards = sortedCards.slice(0, input.limit);

    if (
        !input.focusedSessionKey ||
        limitedCards.some((card) => card.session.key === input.focusedSessionKey)
    ) {
        return limitedCards;
    }

    const focusedCard = sortedCards.find((card) => card.session.key === input.focusedSessionKey);

    if (!focusedCard) {
        return limitedCards;
    }

    return [focusedCard, ...limitedCards.slice(0, Math.max(input.limit - 1, 0))];
}

export function groupSessionCardsWithOptions(
    cards: SessionCardData[],
    options: {
        focusedSessionKey?: string | null;
        limitPerPane?: number;
    }
) {
    const groups = cards.reduce<Record<SessionPaneId, SessionCardData[]>>(
        (nextGroups, card) => {
            nextGroups[getSessionPane(card)].push(card);
            return nextGroups;
        },
        {
            conversations: [],
            cron: [],
        }
    );
    const limit = options.limitPerPane ?? sessionPaneLimit;

    return {
        conversations: limitSessionPane({
            cards: groups.conversations,
            focusedSessionKey: options.focusedSessionKey,
            limit,
        }),
        cron: limitSessionPane({
            cards: groups.cron,
            focusedSessionKey: options.focusedSessionKey,
            limit,
        }),
    };
}
