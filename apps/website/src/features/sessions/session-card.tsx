import * as React from 'react';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { cn } from '../../lib/utils.ts';
import { SessionCardBody } from './session-card-body.tsx';
import { getSessionCardDomId } from './session-card-dom-id.ts';
import { SessionCardHeader } from './session-card-header.tsx';
import { SessionCardMetadata } from './session-card-metadata.tsx';
import type { SessionCardData } from './session-list-data.ts';
import { useSessionCard } from './use-session-card.ts';

export function SessionCard({
    avatarDirectory,
    card,
    highlighted,
}: {
    avatarDirectory: DashboardAvatarDirectory;
    card: SessionCardData;
    highlighted: boolean;
}) {
    const session = card.session;
    const {
        historyOffset,
        parentRelationship,
        sessionError,
        sessionMetadata,
        sessionSummaryLimit,
        sessionHistoryQuery,
    } = useSessionCard(session.key);
    const rows = sessionHistoryQuery.data?.rows ?? [];
    const totalRows = sessionHistoryQuery.data?.total ?? 0;

    React.useEffect(() => {
        if (!sessionError) {
            return;
        }

        console.error('Session card query failed', {
            error: sessionError,
            limit: sessionSummaryLimit,
            offset: historyOffset ?? 0,
            sessionId: session.id,
            sessionKey: session.key,
        });
    }, [historyOffset, session.id, session.key, sessionError, sessionSummaryLimit]);

    return (
        <div
            className={cn(
                'flex h-full min-h-0 w-[34.375rem] min-w-[34.375rem] flex-col overflow-hidden border-border/60 border-r transition-shadow',
                highlighted ? 'bg-sky-500/5 shadow-lg shadow-sky-500/10' : null
            )}
            id={getSessionCardDomId(session.key)}
        >
            <SessionCardHeader
                avatarDirectory={avatarDirectory}
                card={card}
                historyOffset={historyOffset}
                sessionId={session.id}
                sessionKey={session.key}
                sessionSummaryLimit={sessionSummaryLimit}
            />
            <SessionCardMetadata
                agentName={session.agentName}
                duration={sessionMetadata?.duration ?? ''}
                parentRelationship={parentRelationship}
                title={sessionMetadata?.title ?? ''}
                toolCalls={sessionMetadata?.toolCalls ?? 0}
            />
            <SessionCardBody
                currentSessionKey={session.key}
                error={Boolean(sessionError)}
                isPending={sessionHistoryQuery.isPending}
                rows={rows}
                totalRows={totalRows}
            />
        </div>
    );
}
