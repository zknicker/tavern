import { AgentAvatar } from '@tavern/agent-avatars';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge } from '../ui/badge.tsx';

export interface AgentBadgeProps {
    avatar: string;
    backgroundColor: string | null;
    className?: string;
    name: string;
}

export function AgentBadge({
    avatar,
    backgroundColor,
    className,
    name,
}: AgentBadgeProps): React.ReactElement {
    return (
        <Badge
            className={cn(
                'h-7 min-w-0 gap-1.5 rounded-md border-border/60 px-1.5 text-foreground text-sm dark:bg-input/40',
                className
            )}
            data-slot="agent-badge"
            title={name}
            variant="secondary"
        >
            <AgentAvatar
                avatar={avatar}
                backgroundColor={backgroundColor ?? '#64748b'}
                className="size-4 shrink-0"
                name={name}
            />
            <span className="min-w-0 truncate font-medium">{name}</span>
        </Badge>
    );
}
