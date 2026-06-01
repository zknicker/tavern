import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import { DrawerDescription, DrawerHeader, DrawerTitle } from '../../components/ui/drawer.tsx';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { SessionMetadataOutput } from '../../lib/trpc.tsx';
import { SessionResyncButton } from './session-resync-button.tsx';

const typeBadgeVariants: Record<SessionMetadataOutput['type'], BadgeProps['variant']> = {
    chat: 'default',
    cron: 'warning',
    link: 'info',
    portal: 'success',
};

export function SessionDrawerHeader({
    agentName,
    avatarDirectory,
    sessionKey,
    session,
}: {
    agentName: string;
    avatarDirectory: DashboardAvatarDirectory;
    sessionKey: string;
    session: Pick<
        SessionMetadataOutput,
        'agentId' | 'name' | 'platform' | 'source' | 'startedAt' | 'title' | 'type'
    >;
}) {
    const agentAvatar = avatarDirectory.get(session.agentId ?? agentName);

    return (
        <DrawerHeader className="gap-4">
            <div className="flex items-center gap-3">
                <AgentAvatar
                    avatar={agentAvatar.avatar}
                    backgroundColor={agentAvatar.backgroundColor}
                    className="size-9 shrink-0"
                    name={agentName}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <DrawerTitle className="truncate">{session.name}</DrawerTitle>
                        {session.type === 'portal' ? null : (
                            <Badge variant={typeBadgeVariants[session.type]}>{session.type}</Badge>
                        )}
                    </div>
                    <DrawerDescription className="mt-1 truncate">
                        {agentName} · {formatRelativeTime(session.startedAt)}
                    </DrawerDescription>
                </div>
                <SessionResyncButton sessionKey={sessionKey} />
            </div>
        </DrawerHeader>
    );
}
