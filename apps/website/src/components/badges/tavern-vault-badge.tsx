import { Shield01Icon } from '@hugeicons-pro/core-solid-rounded';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge } from '../ui/badge.tsx';
import { Icon } from '../ui/icon.tsx';

export type TavernVaultBadgeProps = ComponentPropsWithoutRef<'span'>;

export function TavernVaultBadge({ className, ...props }: TavernVaultBadgeProps) {
    return (
        <Badge
            className={cn(
                'gap-1 border-transparent bg-muted text-foreground/72 dark:bg-input/32 [&_svg]:opacity-100',
                className
            )}
            data-slot="tavern-vault-badge"
            size="sm"
            variant="secondary"
            {...props}
        >
            <Icon className="shrink-0" icon={Shield01Icon} />
            <span>Tavern Vault</span>
        </Badge>
    );
}
