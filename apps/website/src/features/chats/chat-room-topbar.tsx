import type * as React from 'react';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { useAgentCharacterLookup } from '../../hooks/agents/use-agent-character.ts';
import { cn } from '../../lib/utils.ts';
import { getChannelColorStyle } from '../shell/channel-color-options.ts';
import { AgentFace, type HeadKind } from './agent-face.tsx';
import type { ChatListItem } from './chat-list-data.ts';

export function ChatRoomTopbar({ chat }: { chat: ChatListItem }) {
    const title = formatRoomTitle(chat);
    const participants = getVisibleParticipants(chat);
    const channelStyle = getChannelColorStyle(chat.tabAppearance.color);
    const lookupCharacter = useAgentCharacterLookup();

    return (
        <header
            className="relative z-40 grid h-[var(--topbar-height)] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start bg-background pt-[8px]"
            data-slot="chat-room-topbar"
            data-window-drag-region=""
        >
            <div className="flex min-w-0 items-center gap-2.5 pr-2 pl-[10px]">
                <ChannelIconBox size="topbar" style={channelStyle} />
                <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">{title}</h1>
            </div>
            <div className="no-drag flex min-w-0 items-center justify-end px-2">
                <ul
                    aria-label={`Participants: ${participants.map((participant) => participant.name).join(', ')}`}
                    className="flex items-center -space-x-1.5"
                >
                    {participants.slice(0, 5).map((participant) => (
                        <ParticipantAvatar
                            character={
                                participant.actorType === 'agent'
                                    ? lookupCharacter(participant.actorId)
                                    : 'none'
                            }
                            key={participant.actorId}
                            participant={participant}
                        />
                    ))}
                </ul>
                {participants.length > 5 ? (
                    <span className="ml-2 font-medium text-muted-foreground text-xs tabular-nums">
                        +{participants.length - 5}
                    </span>
                ) : null}
            </div>
        </header>
    );
}

function ParticipantAvatar({
    character,
    participant,
}: {
    character: HeadKind;
    participant: ChatListItem['participants'][number];
}) {
    if (character !== 'none') {
        return (
            <li
                className="relative flex size-6 shrink-0 items-center justify-center"
                title={participant.name}
            >
                <AgentFace
                    animated={false}
                    aria-hidden
                    className="size-6 overflow-visible"
                    head={character}
                    size={24}
                />
            </li>
        );
    }

    const style = getParticipantAvatarStyle(participant);

    return (
        <li
            className={cn(
                'relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[0.5rem] border border-background bg-muted font-medium text-[0.625rem] text-muted-foreground shadow-[0_0_0_1px_var(--border)]',
                participant.primaryColor ? 'text-white' : null
            )}
            style={style}
            title={participant.name}
        >
            {isAvatarImage(participant.avatar) ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={24}
                    src={participant.avatar}
                    width={24}
                />
            ) : (
                getParticipantInitials(participant)
            )}
        </li>
    );
}

function formatRoomTitle(chat: ChatListItem) {
    const title = resolveTavernChatName(chat).trim();

    return chat.conversationKind === 'channel' ? title.replace(/^#+/u, '') || title : title;
}

function getVisibleParticipants(chat: ChatListItem) {
    if (chat.participants.length > 0) {
        return chat.participants;
    }

    if (!chat.targetParticipant) {
        return [];
    }

    return [
        {
            actorId: chat.targetParticipant.id,
            actorType: 'participant' as const,
            avatar: chat.targetParticipant.avatar,
            name: chat.targetParticipant.name,
            primaryColor: chat.targetParticipant.primaryColor,
        },
    ];
}

function getParticipantAvatarStyle(participant: ChatListItem['participants'][number]) {
    return participant.primaryColor
        ? ({ backgroundColor: participant.primaryColor } as React.CSSProperties)
        : undefined;
}

function getParticipantInitials(participant: ChatListItem['participants'][number]) {
    if (participant.avatar && !avatarLooksLikeImage(participant.avatar)) {
        return participant.avatar.slice(0, 2).toUpperCase();
    }

    const words = participant.name.trim().split(/\s+/u).filter(Boolean);
    const initials = words
        .slice(0, 2)
        .map((word) => word[0])
        .join('');

    return (initials || '?').toUpperCase();
}

function isAvatarImage(avatar: string | null): avatar is string {
    return Boolean(avatar && avatarLooksLikeImage(avatar));
}

function avatarLooksLikeImage(avatar: string) {
    return /^(data:image\/|https?:\/\/|blob:)/u.test(avatar);
}
