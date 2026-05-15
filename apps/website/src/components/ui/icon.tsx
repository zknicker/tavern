import { HugeiconsIcon, type HugeiconsIconProps } from '@hugeicons/react';

type IconProps = HugeiconsIconProps;

export function Icon({ 'aria-label': ariaLabel, ...props }: IconProps) {
    return (
        <HugeiconsIcon
            aria-hidden={ariaLabel ? undefined : true}
            aria-label={ariaLabel}
            {...props}
        />
    );
}
