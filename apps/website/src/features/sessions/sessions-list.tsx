import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/card.tsx';
import { useSearch } from '../../hooks/dashboard/use-search.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { SessionCard } from './session-card.tsx';
import { getSessionCardDomId } from './session-card-dom-id.ts';
import {
    buildSessionCards,
    groupSessionCardsWithOptions,
    type SessionListItem,
} from './session-list-data.ts';

interface SessionsListProps {
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    onNavigateToSettings: () => void;
    sessions: SessionListItem[];
}

export function SessionsList({
    connectionState,
    onNavigateToSettings,
    sessions,
}: SessionsListProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const { deferredQuery } = useSearch();
    const [highlightedSessionKey, setHighlightedSessionKey] = React.useState<string | null>(null);
    const focusedSessionKey = searchParams.get('sessionKey');
    const cards = React.useMemo(() => buildSessionCards(sessions), [sessions]);
    const filteredCards = React.useMemo(
        () =>
            cards.filter(
                (card) => deferredQuery.length === 0 || card.searchText.includes(deferredQuery)
            ),
        [cards, deferredQuery]
    );
    const groupedCards = React.useMemo(
        () =>
            groupSessionCardsWithOptions(filteredCards, {
                focusedSessionKey,
            }),
        [filteredCards, focusedSessionKey]
    );
    const visibleCards = React.useMemo(
        () =>
            [...groupedCards.conversations, ...groupedCards.cron].sort(
                (left, right) =>
                    new Date(right.session.startedAt).getTime() -
                    new Date(left.session.startedAt).getTime()
            ),
        [groupedCards]
    );
    const totalVisibleCards = visibleCards.length;

    React.useEffect(() => {
        if (!focusedSessionKey) {
            return;
        }

        const timer = window.setTimeout(() => {
            const target = document.getElementById(getSessionCardDomId(focusedSessionKey));
            if (!target) {
                return;
            }

            target.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center',
            });
            setHighlightedSessionKey(focusedSessionKey);
            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.delete('sessionKey');
                    return next;
                },
                { replace: true }
            );

            window.setTimeout(() => {
                setHighlightedSessionKey((current) =>
                    current === focusedSessionKey ? null : current
                );
            }, 2000);
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [focusedSessionKey, setSearchParams]);

    if (sessions.length === 0) {
        return (
            <EmptyState
                actionLabel="Open settings"
                description={
                    connectionState === 'unconfigured'
                        ? 'Start Tavern Runtime to see synced sessions.'
                        : 'No sessions have been reported yet. Check the Tavern Runtime connection or wait for the next sync.'
                }
                eyebrow={connectionState === 'unconfigured' ? 'Sessions' : 'Waiting for sessions'}
                onAction={onNavigateToSettings}
                title={
                    connectionState === 'unconfigured'
                        ? 'There are no sessions because Tavern Runtime is not connected.'
                        : 'No sessions yet.'
                }
            />
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                {totalVisibleCards > 0 ? (
                    <div className="flex h-full min-w-max items-stretch">
                        {visibleCards.map((card) => (
                            <SessionCard
                                card={card}
                                highlighted={highlightedSessionKey === card.session.key}
                                key={card.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="px-4 pt-2">
                        <Card className="max-w-xl p-6">
                            <h2 className="font-semibold text-foreground text-lg">
                                No matching sessions
                            </h2>
                            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                                Try a broader search to bring sessions or cron runs back into view.
                            </p>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
