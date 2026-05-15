import { AgentAvatar } from '@tavern/agent-avatars';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

const avatarSizeClassName = {
    default: 'size-7',
    sm: 'size-6',
} as const;

export function AgentIdentity({
    avatar,
    backgroundColor,
    className,
    name,
    size = 'default',
}: {
    avatar: string;
    backgroundColor: string;
    className?: string;
    name: string;
    size?: keyof typeof avatarSizeClassName;
}): React.ReactElement {
    return (
        <div className={cn('flex min-w-0 items-center gap-2', className)}>
            <AgentAvatar
                avatar={avatar}
                backgroundColor={backgroundColor}
                className={cn('shrink-0', avatarSizeClassName[size])}
                name={name}
            />
            <span className="min-w-0 truncate font-medium text-foreground text-sm">{name}</span>
        </div>
    );
}
