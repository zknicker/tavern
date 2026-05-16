'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { ArrowRight01Icon, MoreHorizontalIcon } from '@hugeicons-pro/core-duotone-rounded';
import type * as React from 'react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export interface BreadcrumbTrailItem {
    key?: string;
    label: React.ReactNode;
    to?: string;
}

export function Breadcrumb({ ...props }: React.ComponentProps<'nav'>): React.ReactElement {
    return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

export function BreadcrumbTrail({
    className,
    items,
    listClassName,
}: {
    className?: string;
    items: BreadcrumbTrailItem[];
    listClassName?: string;
}): React.ReactElement {
    return (
        <Breadcrumb className={cn('min-w-0 flex-1', className)}>
            <BreadcrumbList className={cn('flex-nowrap', listClassName)}>
                {items.map((item, index) => {
                    const isCurrent = index === items.length - 1;

                    return (
                        <Fragment key={getBreadcrumbTrailItemKey(item)}>
                            <BreadcrumbItem className={cn(isCurrent && 'min-w-0')}>
                                {isCurrent || !item.to ? (
                                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink render={<Link to={item.to} />}>
                                        {item.label}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {isCurrent ? null : <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

function getBreadcrumbTrailItemKey(item: BreadcrumbTrailItem) {
    if (item.key) {
        return item.key;
    }

    if (item.to) {
        return item.to;
    }

    if (typeof item.label === 'string' || typeof item.label === 'number') {
        return item.label;
    }

    throw new Error('BreadcrumbTrail items with non-text labels need a stable key.');
}

export function BreadcrumbList({
    className,
    ...props
}: React.ComponentProps<'ol'>): React.ReactElement {
    return (
        <ol
            className={cn(
                'wrap-break-word flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm sm:gap-2.5',
                className
            )}
            data-slot="breadcrumb-list"
            {...props}
        />
    );
}

export function BreadcrumbItem({
    className,
    ...props
}: React.ComponentProps<'li'>): React.ReactElement {
    return (
        <li
            className={cn('inline-flex items-center gap-1.5', className)}
            data-slot="breadcrumb-item"
            {...props}
        />
    );
}

export function BreadcrumbLink({
    className,
    render,
    ...props
}: useRender.ComponentProps<'a'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            '-mx-2.5 -my-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            className
        ),
        'data-slot': 'breadcrumb-link',
    };

    return useRender({
        defaultTagName: 'a',
        props: mergeProps<'a'>(defaultProps, props),
        render,
    });
}

export function BreadcrumbPage({
    className,
    ...props
}: React.ComponentProps<'span'>): React.ReactElement {
    return (
        <span
            aria-current="page"
            className={cn('truncate font-normal text-foreground', className)}
            data-slot="breadcrumb-page"
            {...props}
        />
    );
}

export function BreadcrumbSeparator({
    children,
    className,
    ...props
}: React.ComponentProps<'li'>): React.ReactElement {
    return (
        <li
            aria-hidden="true"
            className={cn('inline-flex opacity-80 [&_svg]:size-4', className)}
            data-slot="breadcrumb-separator"
            role="presentation"
            {...props}
        >
            {children ?? <Icon icon={ArrowRight01Icon} size={16} strokeWidth={1.8} />}
        </li>
    );
}

export function BreadcrumbEllipsis({
    className,
    ...props
}: React.ComponentProps<'span'>): React.ReactElement {
    return (
        <span
            aria-hidden="true"
            className={cn('inline-flex items-center', className)}
            data-slot="breadcrumb-ellipsis"
            role="presentation"
            {...props}
        >
            <Icon icon={MoreHorizontalIcon} size={16} strokeWidth={1.8} />
            <span className="sr-only">More</span>
        </span>
    );
}
