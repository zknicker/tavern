import { BubbleChatUserIcon } from '@hugeicons/core-free-icons';
import { cn } from '../../lib/utils.ts';
import { CustomBadge } from '../ui/badge.tsx';
import { Icon } from '../ui/icon.tsx';
import { ChatTitle } from './chat-title.tsx';

interface DmBadgeChat {
    conversationKind: 'channel' | 'direct' | 'group' | 'task' | 'topic';
    displayName: string;
    participants: {
        actorType: 'agent' | 'participant';
        name: string;
    }[];
    scope: 'channel' | 'dm' | 'group' | 'task' | 'topic' | null;
    targetParticipant: {
        name: string;
    } | null;
    title: string;
    type: string;
}

export function DmBadge({
    chat,
    className,
    detail = true,
}: {
    chat: DmBadgeChat;
    className?: string;
    detail?: boolean;
}) {
    return (
        <span className={cn('inline-flex items-center gap-1', className)}>
            <CustomBadge
                className="gap-1.5 border-[color:var(--brand-ring)] bg-[color:color-mix(in_srgb,var(--brand-muted),white_14%)] text-brand normal-case tracking-normal"
                variant="secondary"
            >
                <Icon className="size-4 sm:size-3.5" icon={BubbleChatUserIcon} />
                DM
            </CustomBadge>
            {detail ? (
                <CustomBadge
                    className="min-w-0 max-w-[18rem] normal-case tracking-normal"
                    title={chat.title}
                    variant="secondary"
                >
                    <ChatTitle chat={chat} />
                </CustomBadge>
            ) : null}
        </span>
    );
}
