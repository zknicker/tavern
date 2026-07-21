import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { type ChatListItem, getChatAgentId } from '../chats/chat-list-data.ts';

const faceStyle = { flexShrink: 0, height: 28, overflow: 'visible', width: 28 } as const;

export function SearchChatIcon({ chat }: { chat: ChatListItem }) {
    const dark = useResolvedThemeOptional() === 'dark';
    const appearance = useAgentAppearanceLookup()(getChatAgentId(chat));

    if (chat.conversationKind === 'channel') {
        return <ChannelIconBox size="sidebar" />;
    }

    return (
        <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center overflow-visible"
        >
            <AgentFace
                animate={false}
                dark={dark}
                head={appearance.character}
                ink={resolveAgentInk(dark, appearance.primaryColor)}
                size={28}
                style={faceStyle}
            />
        </span>
    );
}
