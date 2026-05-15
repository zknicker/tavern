import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons';
import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';
import {
    getChatDisplayTitle,
    isProjectedRuntimeDm,
    resolveTavernChatName,
} from './chat-display.ts';

interface ChatTitleChat {
    conversationKind: 'channel' | 'direct' | 'group' | 'topic';
    displayName: string;
    participants: {
        actorType: 'agent' | 'participant';
        name: string;
    }[];
    scope: 'channel' | 'dm' | 'group' | 'topic' | null;
    targetParticipant: {
        name: string;
    } | null;
    title: string;
    type: string;
}

export function ChatTitle({ chat, className }: { chat: ChatTitleChat; className?: string }) {
    const title = getChatDisplayTitle(chat);

    if (isProjectedRuntimeDm(chat)) {
        const agentNames = chat.participants
            .filter((participant) => participant.actorType === 'agent')
            .map((participant) => participant.name);
        const agentLabel = agentNames.join(', ');

        return (
            <span
                className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)}
                title={title}
            >
                {agentLabel ? <span className="min-w-0 truncate">{agentLabel}</span> : null}
                {agentLabel ? (
                    <Icon
                        className="size-4 shrink-0 opacity-72 sm:size-3.5"
                        icon={ArrowLeftRightIcon}
                    />
                ) : null}
                <span className="min-w-0 truncate">
                    {chat.targetParticipant?.name ?? chat.displayName}
                </span>
            </span>
        );
    }

    if (chat.type === 'tavern') {
        return (
            <span className={cn('truncate', className)} title={title}>
                {resolveTavernChatName(chat)}
            </span>
        );
    }

    if (chat.conversationKind !== 'direct' || chat.participants.length !== 2) {
        return (
            <span className={cn('truncate', className)} title={title}>
                {title}
            </span>
        );
    }

    const [leftParticipant, rightParticipant] = chat.participants;

    if (!(leftParticipant && rightParticipant)) {
        return (
            <span className={cn('truncate', className)} title={title}>
                {title}
            </span>
        );
    }

    return (
        <span
            className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5', className)}
            title={title}
        >
            <span className="min-w-0 truncate">{leftParticipant.name}</span>
            <Icon className="size-4 shrink-0 opacity-72 sm:size-3.5" icon={ArrowLeftRightIcon} />
            <span className="min-w-0 truncate">{rightParticipant.name}</span>
        </span>
    );
}
