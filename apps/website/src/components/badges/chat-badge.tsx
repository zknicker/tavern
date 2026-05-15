import type { IconSvgElement } from '@hugeicons/react';
import {
    BubbleChatIcon,
    HashtagIcon,
    MessageMultiple02Icon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge } from '../ui/badge.tsx';
import { Icon } from '../ui/icon.tsx';

export type ChatBadgeKind = 'channel' | 'direct' | 'group' | 'topic';

export interface ChatBadgeProps {
    className?: string;
    kind: ChatBadgeKind;
    title: string;
}

const KIND_ICON: Record<ChatBadgeKind, IconSvgElement> = {
    channel: HashtagIcon,
    direct: BubbleChatIcon,
    group: UserMultiple02Icon,
    topic: MessageMultiple02Icon,
};

export function ChatBadge({ className, kind, title }: ChatBadgeProps): React.ReactElement {
    return (
        <Badge
            className={cn(
                'h-7 min-w-0 gap-1.5 rounded-md border-border/60 px-1.5 text-foreground text-sm dark:bg-input/40',
                className
            )}
            data-slot="chat-badge"
            title={title}
            variant="secondary"
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" icon={KIND_ICON[kind]} />
            <span className="min-w-0 truncate">{title}</span>
        </Badge>
    );
}
