'use client';

import { ArrowUp02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button, type ButtonProps } from './primitives/button.tsx';
import { Textarea, type TextareaProps } from './textarea.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.tsx';

interface PromptInputContextValue {
    setTextareaElement: (element: HTMLTextAreaElement | null) => void;
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

export interface PromptInputProps extends Omit<React.ComponentPropsWithoutRef<'form'>, 'children'> {
    children: React.ReactNode;
    contentClassName?: string;
    error?: React.ReactNode;
    onTextEditorFocus?: () => void;
    surfaceClassName?: string;
}

export function PromptInput({
    children,
    className,
    contentClassName,
    error,
    onTextEditorFocus,
    surfaceClassName,
    ...props
}: PromptInputProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setTextareaElement = React.useCallback((element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
    }, []);

    const handleSurfaceMouseDown = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement;

            if (target === textareaRef.current) {
                return;
            }

            if (
                target.closest(
                    'button, a, input, select, textarea, [contenteditable], [role="button"]'
                )
            ) {
                return;
            }

            event.preventDefault();
            if (textareaRef.current) {
                textareaRef.current.focus();
                return;
            }

            onTextEditorFocus?.();
        },
        [onTextEditorFocus]
    );

    return (
        <PromptInputContext.Provider value={{ setTextareaElement }}>
            <form className={cn('px-6 pt-1 pb-4', className)} {...props}>
                <div className={cn('mx-auto w-full max-w-[46rem]', contentClassName)}>
                    {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: The Fluid prompt shell focuses its editor when inert surface space is clicked. */}
                    <div
                        className={cn(
                            'relative flex min-h-[5.5rem] cursor-text flex-col justify-between gap-1 rounded-3xl border border-transparent bg-popover p-2 shadow-sm ring-1 ring-border/80',
                            'transition-[background-color,box-shadow,opacity,transform] duration-300 ease-out',
                            surfaceClassName
                        )}
                        onMouseDown={handleSurfaceMouseDown}
                    >
                        {children}
                    </div>
                    {error ? (
                        <div className="mt-3 px-3 text-destructive text-sm">{error}</div>
                    ) : null}
                </div>
            </form>
        </PromptInputContext.Provider>
    );
}

export function PromptInputHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('flex min-w-0 flex-col gap-2', className)} {...props} />;
}

export function PromptInputBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('relative', className)} {...props} />;
}

export function PromptInputFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('flex items-center justify-between gap-2', className)} {...props} />;
}

export function PromptInputTools({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('flex min-w-0 items-center gap-1.5', className)} {...props} />;
}

export function PromptInputActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('flex shrink-0 items-center gap-1.5', className)} {...props} />;
}

export interface PromptInputTextareaProps extends TextareaProps {
    textOverlay?: React.ReactNode;
}

export function PromptInputTextarea({
    className,
    ref,
    rows = 1,
    textOverlay,
    textareaClassName,
    value,
    ...props
}: PromptInputTextareaProps) {
    const promptInput = React.useContext(PromptInputContext);
    const localRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useLayoutEffect(() => {
        const textarea = localRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        const computedStyle = getComputedStyle(textarea);
        const lineHeight = Number.parseFloat(computedStyle.lineHeight);

        if (Number.isNaN(lineHeight)) {
            return;
        }

        const min = lineHeight * Number(rows || 1);
        const max = lineHeight * 8;
        const nextHeight = Math.min(Math.max(textarea.scrollHeight, min), max);

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > max ? 'auto' : 'hidden';
    });

    const setTextareaRef = React.useCallback(
        (element: HTMLElement | null) => {
            const textarea = element instanceof HTMLTextAreaElement ? element : null;
            localRef.current = textarea;
            promptInput?.setTextareaElement(textarea);
            assignRef(ref, element);
        },
        [promptInput, ref]
    );

    return (
        <>
            {textOverlay ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 pt-2 text-foreground text-sm leading-6 max-sm:text-base"
                >
                    {textOverlay}
                </div>
            ) : null}
            <Textarea
                className={cn('w-full', className)}
                ref={setTextareaRef}
                rows={rows}
                textareaClassName={cn(
                    'min-h-0 resize-none bg-transparent px-3 pt-1.5 pb-0 text-sm leading-6 placeholder:text-muted-foreground/60 max-sm:text-base',
                    textOverlay && 'text-transparent caret-foreground selection:bg-ring/25',
                    textareaClassName
                )}
                unstyled
                value={value}
                {...props}
            />
        </>
    );
}

export interface PromptInputButtonProps extends ButtonProps {
    tooltip?: React.ReactNode;
}

export function PromptInputButton({ tooltip, ...props }: PromptInputButtonProps) {
    const button = <Button {...props} />;

    if (!tooltip) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

export interface PromptInputSubmitProps extends Omit<ButtonProps, 'children' | 'type'> {
    canSubmit: boolean;
    label?: string;
    tooltip?: React.ReactNode;
}

export function PromptInputSubmit({
    canSubmit,
    className,
    disabled,
    label = 'Send',
    size = 'icon-tight',
    tooltip,
    ...props
}: PromptInputSubmitProps) {
    const isDisabled = disabled || !canSubmit;
    const button = (
        <Button
            aria-label={label}
            className={cn('cursor-default disabled:cursor-default', className)}
            disabled={isDisabled}
            size={size}
            type="submit"
            {...props}
        >
            <Icon className="size-6" icon={ArrowUp02Icon} />
        </Button>
    );

    if (!(isDisabled && tooltip)) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                {button}
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

function assignRef<TElement>(ref: React.Ref<TElement> | undefined, element: TElement | null) {
    if (typeof ref === 'function') {
        ref(element);
        return;
    }

    if (ref && 'current' in ref) {
        (ref as React.MutableRefObject<TElement | null>).current = element;
    }
}
