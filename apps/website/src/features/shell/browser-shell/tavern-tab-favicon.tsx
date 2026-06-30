import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatTemporaryIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { cn } from '../../../lib/utils.ts';
import { getChannelColorStyle } from '../channel-color-options.ts';

/**
 * Favicon slot for a Tavern chat tab: a spinner while a turn runs, a (optionally colored)
 * hashtag for channels, otherwise the temporary-chat bubble.
 */
export function TavernTabFavicon({
    busy,
    isChannel = false,
    color = null,
}: {
    busy: boolean;
    isChannel?: boolean;
    color?: string | null;
}) {
    if (busy) {
        return <Spinner className="size-4 shrink-0" />;
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
