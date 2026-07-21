import {
    getChatDisplayTitle,
    resolveTavernChatName,
} from '../../../components/chats/chat-display.ts';

interface ThreadTargetChat {
    conversationKind: 'channel' | 'direct' | 'group' | 'task' | 'topic';
    displayName: string;
    participants: Array<{
        actorId?: string;
        actorType: 'agent' | 'participant';
        name: string;
    }>;
    scope: 'channel' | 'dm' | 'group' | 'task' | 'topic' | null;
    targetParticipant: { name: string } | null;
    title: string;
    type: string;
}

const operatorActorIds = new Set(['usr_tavern', 'profile:self']);

export function threadPaneTitles(chat: ThreadTargetChat, anchorMessageId: string) {
    const shortId = anchorMessageId.replace(/^msg_/u, '').slice(0, 8);

    if (chat.conversationKind === 'direct' || chat.scope === 'dm') {
        const peer = getDmPeerName(chat);
        return {
            header: `Thread — @${peer}`,
            target: `dm:@${peer}:${shortId}`,
        };
    }

    const displayName = getChannelName(chat);
    return {
        header: `Thread — #${displayName}`,
        target: `#${displayName}:${shortId}`,
    };
}

function getChannelName(chat: ThreadTargetChat) {
    const title = chat.type === 'tavern' ? resolveTavernChatName(chat) : getChatDisplayTitle(chat);
    return title.replace(/^#/u, '');
}

function getDmPeerName(chat: ThreadTargetChat) {
    const candidates = chat.participants.filter(
        (participant) => !operatorActorIds.has(participant.actorId ?? '')
    );
    return (
        candidates.find((participant) => participant.actorType === 'agent')?.name ??
        candidates[0]?.name ??
        chat.targetParticipant?.name ??
        getChatDisplayTitle(chat)
    ).replace(/^@/u, '');
}
