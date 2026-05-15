import { cn } from '../../lib/utils.ts';
import { Badge, CustomBadge } from '../ui/badge.tsx';
import { DiscordBadge } from './discord-badge.tsx';
import { DmBadge } from './dm-badge.tsx';
import { TavernBadge } from './tavern-badge.tsx';

interface ChatTypeBadgeChat {
    conversationKind: 'channel' | 'direct' | 'group' | 'topic';
    displayName: string;
    participants: {
        actorType: 'agent' | 'participant';
        name: string;
    }[];
    scope: 'channel' | 'dm' | 'group' | 'topic' | null;
    source: {
        kind: string;
        label: string;
    };
    targetParticipant: {
        name: string;
    } | null;
    title: string;
    type: string;
}

function ScopeBadge({ conversationKind }: { conversationKind: 'group' | 'topic' }) {
    return (
        <CustomBadge className="normal-case tracking-normal" variant="secondary">
            {conversationKind === 'group' ? 'Group' : 'Topic'}
        </CustomBadge>
    );
}

export function ChatTypeBadge({
    chat,
    className,
    showDetail = true,
}: {
    chat: ChatTypeBadgeChat;
    className?: string;
    showDetail?: boolean;
}) {
    const directBadge =
        chat.conversationKind === 'direct' ? <DmBadge chat={chat} detail={showDetail} /> : null;

    if (chat.type === 'discord') {
        return (
            <span className={cn('inline-flex items-center gap-1', className)}>
                <DiscordBadge
                    detail={
                        showDetail && chat.conversationKind !== 'direct' ? chat.displayName : null
                    }
                />
                {directBadge}
                {chat.conversationKind === 'group' || chat.conversationKind === 'topic' ? (
                    <ScopeBadge conversationKind={chat.conversationKind} />
                ) : null}
            </span>
        );
    }

    if (chat.type === 'tavern') {
        return (
            <span className={cn('inline-flex items-center gap-1', className)}>
                <TavernBadge
                    detail={
                        showDetail && chat.conversationKind !== 'direct' ? chat.displayName : null
                    }
                />
                {chat.conversationKind === 'group' || chat.conversationKind === 'topic' ? (
                    <ScopeBadge conversationKind={chat.conversationKind} />
                ) : null}
            </span>
        );
    }

    if (chat.source.kind === 'internal') {
        return null;
    }

    return (
        <span className={cn('inline-flex items-center gap-1', className)}>
            <Badge variant={getSourceBadgeVariant(chat.source.kind)}>{chat.source.label}</Badge>
            {directBadge}
            {showDetail && chat.conversationKind !== 'direct' ? (
                <CustomBadge
                    className="max-w-[16rem] truncate normal-case tracking-normal"
                    title={chat.displayName}
                    variant="secondary"
                >
                    {chat.displayName}
                </CustomBadge>
            ) : null}
        </span>
    );
}

function getSourceBadgeVariant(kind: string) {
    switch (kind) {
        case 'cron':
            return 'warning';
        case 'acp':
        case 'cli':
        case 'subagent':
            return 'info';
        default:
            return 'secondary';
    }
}
