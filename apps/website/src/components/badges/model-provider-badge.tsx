import type { IconSvgElement } from '@hugeicons/react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge, type BadgeProps } from '../ui/badge.tsx';
import { ModelProviderLogo, type ModelProviderLogoSource } from './model-provider-logo.tsx';

export interface ModelProviderBadgeProps extends ComponentPropsWithoutRef<'span'> {
    color: string;
    icon: IconSvgElement;
    label: string;
    logo?: ModelProviderLogoSource | null;
    size?: BadgeProps['size'];
}

export function ModelProviderBadge({
    className,
    color,
    icon,
    label,
    logo,
    size = 'default',
    style,
    ...props
}: ModelProviderBadgeProps) {
    return (
        <Badge
            className={cn('min-w-0 gap-1 border-transparent pr-1.5 pl-1', className)}
            data-slot="model-provider-badge"
            size={size}
            style={{
                backgroundColor: `color-mix(in srgb, ${color} 18%, var(--background))`,
                color: `color-mix(in srgb, ${color} 78%, var(--foreground))`,
                ...style,
            }}
            variant="secondary"
            {...props}
        >
            <ModelProviderLogo
                className="bg-transparent"
                color={color}
                fallbackIcon={icon}
                iconClassName="size-3.5"
                logo={logo}
            />
            <span className="min-w-0 truncate">{label}</span>
        </Badge>
    );
}
