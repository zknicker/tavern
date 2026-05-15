import type { HugeiconsIconProps } from '@hugeicons/react';

type BrandIconProps = Pick<
    HugeiconsIconProps,
    'disableSecondaryOpacity' | 'primaryColor' | 'secondaryColor' | 'strokeWidth'
>;

export function brandIconProps(isActive = true): BrandIconProps {
    return {
        disableSecondaryOpacity: true,
        primaryColor: isActive ? 'var(--color-brand)' : 'var(--sidebar-icon-muted)',
        secondaryColor: isActive ? 'var(--color-brand-ring)' : 'var(--sidebar-icon-muted)',
    };
}
