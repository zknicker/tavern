import type { IconSvgElement } from '@hugeicons/react';
import { cn } from '../../lib/utils.ts';
import { Icon } from '../ui/icon.tsx';

export interface ModelProviderLogoSource {
    dark?: string;
    light: string;
}

interface ModelProviderLogoProps {
    className?: string;
    color: string;
    fallbackIcon: IconSvgElement;
    iconClassName?: string;
    logo?: ModelProviderLogoSource | null;
}

export function ModelProviderLogo({
    className,
    color,
    fallbackIcon,
    iconClassName,
    logo,
}: ModelProviderLogoProps) {
    return (
        <span
            className={cn('flex shrink-0 items-center justify-center', className)}
            style={{
                backgroundColor: `${color}1A`,
                color,
            }}
        >
            {logo ? (
                <>
                    <img
                        alt=""
                        className={cn('object-contain', iconClassName, logo.dark && 'dark:hidden')}
                        draggable={false}
                        height={20}
                        src={logo.light}
                        width={20}
                    />
                    {logo.dark ? (
                        <img
                            alt=""
                            className={cn('hidden object-contain dark:block', iconClassName)}
                            draggable={false}
                            height={20}
                            src={logo.dark}
                            width={20}
                        />
                    ) : null}
                </>
            ) : (
                <Icon className={iconClassName} icon={fallbackIcon} />
            )}
        </span>
    );
}
