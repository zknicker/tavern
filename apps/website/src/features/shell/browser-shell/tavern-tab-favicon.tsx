import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatTemporaryIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { useAgentAppearanceLookup } from '../../../hooks/agents/use-agent-appearance.ts';
import { cn } from '../../../lib/utils.ts';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { AgentFace } from '../../chats/agent-face.tsx';
import { getChannelColorStyle } from '../channel-color-options.ts';

// 18px art in the 16px favicon slot — same optical-parity bleed as the
// sidebar and topbar face slots.
const faceStyle = { flexShrink: 0, height: 18, overflow: 'visible', width: 18 } as const;

/**
 * Favicon slot for a Tavern chat tab: a spinner while a turn runs, a (optionally
 * colored) hashtag for channels, the agent's face for DMs, otherwise the
 * temporary-chat bubble.
 */
export function TavernTabFavicon({
    agentId = null,
    busy,
    isChannel = false,
    color = null,
}: {
    agentId?: string | null;
    busy: boolean;
    isChannel?: boolean;
    color?: string | null;
}) {
    const lookupAppearance = useAgentAppearanceLookup();
    const dark = useResolvedThemeOptional() === 'dark';

    if (busy) {
        return <Spinner className="size-4 shrink-0" />;
    }

    const appearance = isChannel ? null : lookupAppearance(agentId);

    if (appearance && appearance.character !== 'none') {
        return (
            <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={appearance.character}
                    ink={resolveAgentInk(dark, appearance.primaryColor)}
                    size={18}
                    style={faceStyle}
                />
            </span>
        );
    }

    const colorStyle = isChannel ? getChannelColorStyle(color) : undefined;

    return (
        <Icon
            aria-hidden="true"
            className={cn(
                'size-4 shrink-0 opacity-70',
                colorStyle
                    ? 'text-[var(--channel-color-light)] dark:text-[var(--channel-color-dark)]'
                    : null
            )}
            icon={isChannel ? HashtagIcon : BubbleChatTemporaryIcon}
            size={16}
            style={colorStyle}
        />
    );
}
