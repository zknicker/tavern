import { AgentAvatar } from '@tavern/agent-avatars';
import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { SessionCopyActions } from './session-copy-actions.tsx';
import type { SessionCardData, SessionListItem } from './session-list-data.ts';

const typeBadgeVariants: Record<SessionListItem['type'], BadgeProps['variant']> = {
    chat: 'default',
    cron: 'warning',
    link: 'info',
    portal: 'success',
};

interface SessionCardHeaderProps {
    avatarDirectory: DashboardAvatarDirectory;
    card: SessionCardData;
    historyOffset: number | null;
    sessionId: string;
    sessionKey: string;
    sessionSummaryLimit: number;
}

export function SessionCardHeader({
    avatarDirectory,
    card,
    historyOffset,
    sessionId,
    sessionKey,
    sessionSummaryLimit,
}: SessionCardHeaderProps) {
    const session = card.session;
    const agentAvatar = avatarDirectory.get(session.agentName);

    return (
        <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2">
            <AgentAvatar
                avatar={agentAvatar.avatar}
                backgroundColor={agentAvatar.backgroundColor}
                className="size-5 shrink-0"
                name={session.agentName}
            />
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
