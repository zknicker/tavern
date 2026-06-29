import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import { BubbleChatTemporaryIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { cn } from '../../../lib/utils.ts';

/**
 * Favicon slot for a Tavern chat tab: a spinner while a turn runs, a colored hashtag
 * for pinned chats, otherwise the temporary-chat bubble.
 */
export function TavernTabFavicon({
    busy,
    color,
    pinned = false,
}: {
    busy: boolean;
    color?: string | null;
    pinned?: boolean;
}) {
    if (busy) {
        return <Spinner className="size-4 shrink-0" />;
    }

    return (
        <Icon
            aria-hidden="true"
            className={cn(
                'size-4 shrink-0 opacity-70',
                pinned && color
                    ? 'text-[var(--pinned-tab-color-light)] dark:text-[var(--pinned-tab-color-dark)]'
                    : null
            )}
            icon={pinned ? HashtagIcon : BubbleChatTemporaryIcon}
            size={16}
            style={pinned ? pinnedIconStyle : undefined}
        />
    );
}

const pinnedIconStyle: React.CSSProperties = {
    stroke: 'currentColor',
    strokeWidth: 0.6,
};
