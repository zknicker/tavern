import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import { SessionCopyActions } from './session-copy-actions.tsx';
import type { SessionCardData, SessionListItem } from './session-list-data.ts';

const typeBadgeVariants: Record<SessionListItem['type'], BadgeProps['variant']> = {
    chat: 'default',
    cron: 'warning',
    link: 'info',
    portal: 'success',
};

interface SessionCardHeaderProps {
    card: SessionCardData;
    historyOffset: number | null;
    sessionId: string;
    sessionKey: string;
    sessionSummaryLimit: number;
}

export function SessionCardHeader({
    card,
    historyOffset,
    sessionId,
    sessionKey,
    sessionSummaryLimit,
}: SessionCardHeaderProps) {
    return (
        <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2">
            <h3 className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm tracking-tight">
                {card.label}
            </h3>
            <span className="shrink-0 font-mono text-muted-foreground/60 text-xs tabular-nums">
                {card.lastActivity}
            </span>
            {card.type === 'portal' ? null : (
                <Badge variant={typeBadgeVariants[card.type]}>{card.type}</Badge>
            )}
            <SessionCopyActions
                historyOffset={historyOffset}
                limit={sessionSummaryLimit}
                sessionId={sessionId}
                sessionKey={sessionKey}
            />
        </div>
    );
}
