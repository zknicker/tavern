import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { getChannelColorStyle } from '../shell/channel-color-options.ts';
import { AgentFace } from './agent-face.tsx';
import { AgentPresenceBadge } from './agent-presence.tsx';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';
import { ChatPaneToggleButton } from './chat-pane-toggle-button.tsx';
import { ChatParticipantFacepile } from './chat-participant-facepile.tsx';
import { ChatParticipantsEditButton } from './chat-participants-edit-button.tsx';

/**
 * Chat header for the sidebar layout: room identity on the left, participants
 * on the right, and the macOS traffic-light clearance the layout's CSS keys
 * off `data-slot="chat-room-topbar"`. The tabs layout renders no chat topbar —
 * its shell toolbar carries the breadcrumb and participants instead.
 */
export function ChatRoomTopbar({ chat }: { chat: ChatListItem }) {
    const title = formatRoomTitle(chat);

    return (
        <header
            className="relative z-40 grid h-[var(--topbar-height)] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start bg-background pt-[8px]"
            data-slot="chat-room-topbar"
            data-window-drag-region=""
        >
            <div className="flex min-w-0 items-center gap-2.5 pr-2 pl-[10px]">
                <RoomIcon chat={chat} />
                <h1 className="min-w-0 truncate font-semibold text-foreground text-sm">{title}</h1>
                <AgentPresenceBadge chat={chat} />
                {chat.archived ? <Badge variant="secondary">Archived</Badge> : null}
            </div>
            <div className="no-drag flex min-w-0 items-center justify-end gap-1 px-2">
                <ChatParticipantFacepile chat={chat} />
                <ChatParticipantsEditButton chat={chat} />
                <ChatPaneToggleButton chatId={chat.id} />
            </div>
        </header>
    );
}

// Channels keep the colored hash box; DMs are represented by their agent's
// face, matching the sidebar row (24px art in a 20px slot for optical parity).
const topbarFaceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

function RoomIcon({ chat }: { chat: ChatListItem }) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';
    const channelStyle = getChannelColorStyle(chat.tabAppearance.color);

    if (chat.conversationKind === 'channel') {
        return <ChannelIconBox size="topbar" style={channelStyle} />;
    }

    const appearance = lookupAppearance(getChatAgentId(chat));

    if (appearance.character === 'none') {
        return <ChannelIconBox size="topbar" style={channelStyle} />;
    }

    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
            <AgentFace
                animate={false}
                dark={dark}
                head={appearance.character}
                ink={resolveAgentInk(dark, appearance.primaryColor)}
                size={24}
                style={topbarFaceStyle}
            />
        </span>
    );
}

function formatRoomTitle(chat: ChatListItem) {
    const title = resolveTavernChatName(chat).trim();

    return chat.conversationKind === 'channel' ? title.replace(/^#+/u, '') || title : title;
}
