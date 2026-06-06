import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { FieldError } from './primitives/field.tsx';

type SettingsItemProps = React.ComponentProps<'div'>;
type SettingsActionRowProps = React.ComponentProps<'button'>;

interface SettingsRowProps {
    children: React.ReactNode;
    className?: string;
    density?: 'default' | 'compact';
    description?: React.ReactNode;
    error?: string | null;
    title: React.ReactNode;
    trailingWidth?: 'default' | 'intrinsic';
}

type SettingsValueProps = React.ComponentProps<'div'>;

export function SettingsItem({ className, ...props }: SettingsItemProps) {
    return <div className={cn('px-3.5 py-3.5', className)} {...props} />;
}

export function SettingsActionRow({ className, ...props }: SettingsActionRowProps) {
    return (
        <button
            className={cn(
                'flex w-full cursor-pointer items-center justify-center gap-2 px-3.5 py-2.5 font-medium text-foreground text-sm outline-none transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 disabled:pointer-events-none disabled:opacity-64',
                className
            )}
            type="button"
            {...props}
        />
    );
}

export function SettingsRow({
    children,
    className,
    density = 'default',
    description,
    error = null,
    title,
    trailingWidth = 'default',
}: SettingsRowProps) {
    return (
        <div
            className={cn(
                'grid gap-3 py-3.5 md:items-center md:gap-6',
                trailingWidth === 'default'
                    ? 'md:grid-cols-[minmax(10rem,1fr)_minmax(18rem,32rem)]'
                    : 'md:grid-cols-[minmax(0,1fr)_auto]',
                density === 'default' ? 'ps-5 pe-3.5' : 'px-3.5',
                className
            )}
        >
            <div className="space-y-0.5">
                <h3 className="font-medium text-foreground text-sm">{title}</h3>
                {description ? (
                    <div className="text-muted-foreground text-sm">{description}</div>
                ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2 md:w-full md:justify-self-end">
                {children}
                {error ? <FieldError>{error}</FieldError> : null}
            </div>
        </div>
    );
}

export function SettingsValue({ className, ...props }: SettingsValueProps) {
    return (
        <div
            className={cn(
                'flex min-h-8 items-center text-muted-foreground text-sm md:justify-end md:text-right',
                className
            )}
            {...props}
        />
    );
}
