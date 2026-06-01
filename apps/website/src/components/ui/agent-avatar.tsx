import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export type AvatarEmote = 'focused' | 'happy' | 'idle' | 'sleepy' | 'surprised';

export interface AgentAvatarProps {
    active?: boolean;
    avatar?: string | null;
    backgroundColor?: string | null;
    className?: string;
    emote?: AvatarEmote;
    name?: string | null;
}

export const AgentAvatar = React.memo(function AgentAvatar({
    active = false,
    avatar,
    backgroundColor,
    className,
    name,
}: AgentAvatarProps) {
    const label = name?.trim() || avatar?.trim() || 'Agent';
    const display = resolveAvatarDisplay(avatar, label);

    return (
        <span
            className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 font-semibold text-[0.6875rem] text-white leading-none shadow-inner',
                active && 'ring-2 ring-foreground/20',
                className
            )}
            style={{ backgroundColor: backgroundColor || '#64748b' }}
            title={`${label} avatar`}
        >
            {display}
        </span>
    );
});

function resolveAvatarDisplay(avatar: string | null | undefined, fallback: string) {
    const source = avatar?.trim() || fallback.trim();
    const glyphs = Array.from(source);

    if (glyphs.length <= 2 && source.length <= 4) {
        return source;
    }

    const words = source.match(/[A-Za-z0-9]+/g) ?? [];

    if (words.length >= 2) {
        return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
    }

    return (words[0]?.slice(0, 2) || glyphs.slice(0, 2).join('')).toUpperCase();
}
