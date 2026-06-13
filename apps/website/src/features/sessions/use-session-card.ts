import { useSessionHistory } from '../../hooks/sessions/use-session-history.ts';

const sessionSummaryLimit = 10;

export function useSessionCard(sessionKey: string | null) {
    const resolvedSessionKey = sessionKey ?? 'session-card';
    const isEnabled = sessionKey !== null;
    const sessionHistoryQuery = useSessionHistory(
        {
            limit: sessionSummaryLimit,
            sessionKey: resolvedSessionKey,
        },
        {
            enabled: isEnabled,
        }
    );

    return {
        historyOffset: sessionHistoryQuery.data?.offset ?? null,
        parentRelationship: sessionHistoryQuery.data?.parentRelationship ?? null,
        sessionError: sessionHistoryQuery.error ?? null,
        sessionMetadata: sessionHistoryQuery.data?.session ?? null,
        sessionSummaryLimit,
        sessionHistoryQuery,
    };
}
