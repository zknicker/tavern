'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Textarea } from './textarea.tsx';

export interface ChatComposerProps
    extends Omit<React.ComponentPropsWithoutRef<'form'>, 'children' | 'onChange'> {
    composerPopover?: React.ReactNode;
    contentClassName?: string;
    disabled?: boolean;
    error?: React.ReactNode;
    footerEnd?: React.ReactNode;
    footerStart?: React.ReactNode;
    name: string;
    onTextChange: (value: string, element: HTMLTextAreaElement) => void;
    onTextKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onTextSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
    placeholder: string;
    surfaceClassName?: string;
    textareaRef?: React.Ref<HTMLTextAreaElement>;
    textareaRows?: number;
    textOverlay?: React.ReactNode;
    value: string;
}

export function ChatComposer({
    className,
    contentClassName,
    disabled = false,
    error,
    footerEnd,
    footerStart,
    name,
    onTextChange,
    onTextKeyDown,
    onTextSelect,
    placeholder,
    composerPopover,
    surfaceClassName,
    textOverlay,
    textareaRef,
    textareaRows = 2,
    value,
    ...props
}: ChatComposerProps) {
    return (
        <form className={cn('px-6 pt-2 pb-6', className)} {...props}>
            <div className={cn('mx-auto w-full max-w-[46rem]', contentClassName)}>
                <div
                    className={cn(
                        'relative rounded-[1.5rem] bg-popover p-2 shadow-black/7 shadow-xl ring-1 ring-border/75 transition-[box-shadow] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(1.5rem-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:ring-ring/45 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
                        surfaceClassName
                    )}
                >
                    <div className="relative">
                        {textOverlay ? (
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 text-foreground text-sm leading-6 max-sm:text-base"
                            >
                                {textOverlay}
                            </div>
                        ) : null}
                        <Textarea
                            aria-label={placeholder}
                            className="w-full"
                            disabled={disabled}
                            name={name}
                            onChange={(event) => onTextChange(event.target.value, event.target)}
                            onClick={onTextSelect}
                            onKeyDown={onTextKeyDown}
                            onKeyUp={onTextSelect}
                            onSelect={onTextSelect}
                            placeholder={placeholder}
                            ref={textareaRef}
                            rows={textareaRows}
                            textareaClassName={cn(
                                'min-h-14 resize-none bg-transparent px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground/55 max-sm:text-base',
                                textOverlay &&
                                    'text-transparent caret-foreground selection:bg-ring/25'
                            )}
                            unstyled
                            value={value}
                        />
                    </div>
                    {composerPopover}
                    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
                        <div className="min-w-0">{footerStart}</div>
                        <div className="flex shrink-0 items-center gap-2">{footerEnd}</div>
                    </div>
                </div>
                {error ? <div className="mt-3 px-3 text-destructive text-sm">{error}</div> : null}
            </div>
        </form>
    );
}
