import type { HugeiconsIconProps } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../components/ui/collapsible.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';

type StepStatus = 'active' | 'complete' | 'pending' | 'failed';
type StepIcon = HugeiconsIconProps['icon'];

interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

export const ThinkingSteps = forwardRef<HTMLDivElement, ThinkingStepsProps>(
    (
        {
            children,
            className,
            defaultOpen = true,
            onOpenChange,
            open,
            // Collapsible does not use defaultValue; keep this compatible with the registry shape.
            defaultValue: _defaultValue,
            ...props
        },
        ref
    ) => (
        <Collapsible
            className={cn('w-80 max-w-full', className)}
            defaultOpen={open === undefined ? defaultOpen : undefined}
            onOpenChange={onOpenChange}
            open={open}
            ref={ref}
            {...props}
        >
            {children}
        </Collapsible>
    )
);

ThinkingSteps.displayName = 'ThinkingSteps';

interface ThinkingStepsHeaderProps extends HTMLAttributes<HTMLButtonElement> {
    children?: ReactNode;
    showIcon?: boolean;
    wrapperClassName?: string;
}

export const ThinkingStepsHeader = forwardRef<HTMLButtonElement, ThinkingStepsHeaderProps>(
    ({ children = 'Thinking', className, showIcon = true, wrapperClassName, ...props }, ref) => (
        <div className={cn('w-fit', wrapperClassName)}>
            <CollapsibleTrigger
                className={cn(
                    'group flex w-auto items-center gap-1.5 rounded-md py-1 font-medium text-[13px] text-foreground leading-tight transition-colors hover:text-foreground',
                    className
                )}
                ref={ref}
                {...props}
            >
                <span>{children}</span>
                {showIcon ? (
                    <Icon
                        className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                ) : null}
            </CollapsibleTrigger>
        </div>
    )
);

ThinkingStepsHeader.displayName = 'ThinkingStepsHeader';

interface ThinkingStepsContentProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const ThinkingStepsContent = forwardRef<HTMLDivElement, ThinkingStepsContentProps>(
    ({ children, className, ...props }, ref) => (
        <CollapsiblePanel>
            <div className={cn('flex flex-col', className)} ref={ref} {...props}>
                {children}
            </div>
        </CollapsiblePanel>
    )
);

ThinkingStepsContent.displayName = 'ThinkingStepsContent';

interface ThinkingStepProps {
    animate?: boolean;
    children?: ReactNode;
    className?: string;
    delay?: number;
    description?: ReactNode;
    icon?: StepIcon;
    index: number;
    isLast?: boolean;
    label: ReactNode;
    showIcon?: boolean;
    status?: StepStatus;
}

export function ThinkingStep({
    animate = true,
    children,
    className,
    delay = 0,
    description,
    icon,
    isLast = false,
    label,
    showIcon = true,
    status = 'complete',
}: ThinkingStepProps) {
    if (status === 'pending') {
        return null;
    }

    const isActive = status === 'active';

    return (
        <div
            className={cn(
                'relative z-10 overflow-hidden',
                animate &&
                    'motion-safe:animate-[chat-loading-indicator-in_260ms_cubic-bezier(0.23,1,0.32,1)_both]',
                className
            )}
            style={{ animationDelay: `${delay}s` }}
        >
            <div className="flex gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/35">
                <div className="flex w-[14px] shrink-0 flex-col items-center">
                    <div className="pt-0.5">
                        {showIcon && icon ? (
                            <Icon
                                className="size-3.5 text-muted-foreground"
                                icon={icon}
                                strokeWidth={1.5}
                            />
                        ) : (
                            <div className="flex size-3.5 items-center justify-center">
                                <div
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        status === 'failed'
                                            ? 'bg-destructive'
                                            : isActive
                                              ? 'bg-info shadow-[0_0_0_3px] shadow-info/12'
                                              : 'bg-muted-foreground/60'
                                    )}
                                />
                            </div>
                        )}
                    </div>
                    {isLast ? null : <div className="mt-1 w-px flex-1 bg-border/60" />}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                        className={cn(
                            'min-w-0 text-[13px] text-foreground leading-tight',
                            isActive && 'thinking-indicator-text'
                        )}
                    >
                        {label}
                        {isActive && typeof label === 'string' ? '...' : null}
                    </span>
                    {description ? (
                        <span className="min-w-0 text-[13px] text-muted-foreground leading-snug">
                            {description}
                        </span>
                    ) : null}
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ThinkingStepDetailsProps {
    children?: ReactNode;
    className?: string;
    defaultOpen?: boolean;
    details?: string[];
    summary: string;
}

export function ThinkingStepDetails({
    children,
    className,
    defaultOpen = false,
    details,
    summary,
}: ThinkingStepDetailsProps) {
    return (
        <Collapsible className={cn('mt-1 -ml-3', className)} defaultOpen={defaultOpen}>
            <div className="w-fit">
                <CollapsibleTrigger className="flex w-auto items-center gap-1.5 rounded-md px-3 py-1 text-[13px] text-muted-foreground leading-tight transition-colors hover:bg-muted/35 hover:text-foreground">
                    <span>{summary}</span>
                    <Icon className="size-3 opacity-70" icon={ArrowDown01Icon} strokeWidth={1.7} />
                </CollapsibleTrigger>
            </div>
            <CollapsiblePanel>
                <div className="flex flex-col gap-0.5 pt-0.5">
                    {details?.map((item) => (
                        <span className="text-[12px] text-muted-foreground leading-snug" key={item}>
                            {item}
                        </span>
                    ))}
                    {children}
                </div>
            </CollapsiblePanel>
        </Collapsible>
    );
}

interface ThinkingStepSourcesProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const ThinkingStepSources = forwardRef<HTMLDivElement, ThinkingStepSourcesProps>(
    ({ children, className, ...props }, ref) => (
        <div className={cn('mt-1 flex flex-wrap gap-1.5', className)} ref={ref} {...props}>
            {children}
        </div>
    )
);

ThinkingStepSources.displayName = 'ThinkingStepSources';

interface ThinkingStepSourceProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    variant?: 'error' | 'info' | 'secondary' | 'subtle' | 'success';
}

export function ThinkingStepSource({
    children,
    className,
    delay = 0,
    variant = 'subtle',
}: ThinkingStepSourceProps) {
    return (
        <span
            className="motion-safe:animate-[chat-loading-indicator-in_220ms_cubic-bezier(0.23,1,0.32,1)_both]"
            style={{ animationDelay: `${delay}s` }}
        >
            <Badge className={className} size="sm" variant={variant}>
                {children}
            </Badge>
        </span>
    );
}

export type { ThinkingStepImageProps } from './thinking-step-image.tsx';
export { ThinkingStepImage } from './thinking-step-image.tsx';

export type {
    StepStatus,
    ThinkingStepDetailsProps,
    ThinkingStepProps,
    ThinkingStepSourceProps,
    ThinkingStepSourcesProps,
    ThinkingStepsContentProps,
    ThinkingStepsHeaderProps,
    ThinkingStepsProps,
};
