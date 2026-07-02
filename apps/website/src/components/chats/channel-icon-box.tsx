import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';

// One geometry everywhere; variants only swap the surface color tokens.
const channelIconBoxGeometry = 'size-5 rounded-[0.4375rem]';
const channelIconSize = 14;
// Inline size so container rules like the sidebar menu button's
// `[&_svg]:size-4.5` cannot inflate the glyph.
const channelIconStyle = { height: channelIconSize, width: channelIconSize } as const;

const channelIconBoxVariants = {
    sidebar: {
        boxClassName:
            'bg-[var(--channel-color-bg-light,var(--sidebar-accent))] text-[var(--channel-color-light,var(--sidebar-muted))] dark:bg-[var(--channel-color-bg-dark,var(--sidebar-accent))] dark:text-[var(--channel-color-dark,var(--sidebar-muted))]',
    },
    topbar: {
        boxClassName:
            'bg-[var(--channel-color-bg-light,var(--muted))] text-[var(--channel-color-light,var(--muted-foreground))] dark:bg-[var(--channel-color-bg-dark,var(--muted))] dark:text-[var(--channel-color-dark,var(--muted-foreground))]',
    },
} as const;

export function ChannelIconBox({
    className,
    iconClassName,
    size = 'sidebar',
    style,
}: {
    className?: string;
    iconClassName?: string;
    size?: keyof typeof channelIconBoxVariants;
    style?: React.CSSProperties;
}) {
    const variant = channelIconBoxVariants[size];

    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center',
                channelIconBoxGeometry,
                variant.boxClassName,
                className
            )}
            style={style}
        >
            <Icon
                className={cn('shrink-0', iconClassName)}
                icon={HashtagIcon}
                size={channelIconSize}
                style={channelIconStyle}
            />
        </span>
    );
}
