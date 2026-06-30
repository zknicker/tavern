import { HashtagIcon } from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';

const channelIconBoxVariants = {
    sidebar: {
        boxClassName:
            'size-[1.125rem] rounded-[0.375rem] bg-[var(--channel-color-bg-light,var(--sidebar-accent))] text-[var(--channel-color-light,var(--sidebar-muted))] dark:bg-[var(--channel-color-bg-dark,var(--sidebar-accent))] dark:text-[var(--channel-color-dark,var(--sidebar-muted))]',
        iconClassName: 'size-[0.8125rem]',
        iconSize: 13,
    },
    topbar: {
        boxClassName:
            'size-6 rounded-[0.5rem] bg-[var(--channel-color-bg-light,var(--muted))] text-[var(--channel-color-light,var(--muted-foreground))] dark:bg-[var(--channel-color-bg-dark,var(--muted))] dark:text-[var(--channel-color-dark,var(--muted-foreground))]',
        iconClassName: 'size-[0.9375rem]',
        iconSize: 15,
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
                variant.boxClassName,
                className
            )}
            style={style}
        >
            <Icon
                className={cn(variant.iconClassName, iconClassName)}
                icon={HashtagIcon}
                size={variant.iconSize}
            />
        </span>
    );
}
