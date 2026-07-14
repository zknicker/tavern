'use client';

import { Search } from '@hugeicons/core-free-icons';
import type * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Icon } from '../icon.tsx';
import { Input, type InputProps } from './input.tsx';

export type SearchInputProps = Omit<InputProps, 'type'>;

export function SearchInput({
    className,
    placeholder = 'Search...',
    size = 'lg',
    ...props
}: SearchInputProps): React.ReactElement {
    const compact = size === 'sm';

    return (
        <div
            className={cn(
                'relative select-text',
                compact ? '[&_[data-slot=input]]:ps-8' : '[&_[data-slot=input]]:ps-10',
                className
            )}
        >
            <Icon
                className={cn(
                    'pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground/85',
                    compact ? 'start-2.5 size-3.5' : 'start-3.5 size-4'
                )}
                icon={Search}
            />
            <Input placeholder={placeholder} size={size} type="search" {...props} />
        </div>
    );
}
