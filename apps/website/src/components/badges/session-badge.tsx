import { Layers02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge } from '../ui/badge.tsx';
import { Icon } from '../ui/icon.tsx';

export interface SessionBadgeProps {
    className?: string;
    sessionKey: string;
}

export function SessionBadge({ className, sessionKey }: SessionBadgeProps): React.ReactElement {
    return (
        <Badge
            className={cn(
                'h-7 min-w-0 gap-1.5 rounded-md border-border/60 px-1.5 text-foreground/82 text-sm dark:bg-input/40',
                className
            )}
            data-slot="session-badge"
            title={sessionKey}
            variant="secondary"
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" icon={Layers02Icon} />
            <span className="min-w-0 truncate font-mono">{sessionKey}</span>
        </Badge>
    );
}
