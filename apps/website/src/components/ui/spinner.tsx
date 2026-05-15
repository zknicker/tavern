import { Loading03Icon } from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

type SpinnerProps = Omit<React.ComponentProps<typeof Icon>, 'icon'>;

export function Spinner({ className, ...props }: SpinnerProps): React.ReactElement {
    return (
        <Icon
            className={cn('size-4 animate-spin', className)}
            data-slot="spinner"
            icon={Loading03Icon}
            {...props}
        />
    );
}
