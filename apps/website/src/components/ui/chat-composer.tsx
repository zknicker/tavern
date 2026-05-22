'use client';

import { ArrowUp02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button, type ButtonProps } from './primitives/button.tsx';
import { Textarea } from './textarea.tsx';

export interface ChatComposerProps
    extends Omit<React.ComponentPropsWithoutRef<'form'>, 'children' | 'onChange'> {
    canSubmit?: boolean;
    composerPopover?: React.ReactNode;
    contentClassName?: string;
    disabled?: boolean;
    error?: React.ReactNode;
    footerEnd?: React.ReactNode;
    footerStart?: React.ReactNode;
    name: string;
    onTextChange: (value: string, element: HTMLTextAreaElement) => void;
    onTextEditorFocus?: () => void;
    onTextKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    onTextSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
    placeholder: string;
    submitButtonClassName?: string;
    submitButtonLabel?: string;
    submitButtonSize?: ButtonProps['size'];
    surfaceClassName?: string;
    textareaId?: string;
    textareaRef?: React.Ref<HTMLTextAreaElement>;
    textareaRows?: number;
    textEditor?: React.ReactNode;
    textOverlay?: React.ReactNode;
    value: string;
}

export function ChatComposer({
    canSubmit = false,
    className,
    contentClassName,
    disabled = false,
    error,
    footerEnd,
    footerStart,
    name,
    onTextEditorFocus,
    onTextChange,
    onTextKeyDown,
    onTextSelect,
    placeholder,
    composerPopover,
    surfaceClassName,
    submitButtonLabel = 'Send',
    submitButtonClassName,
    submitButtonSize = 'icon-tight',
    textOverlay,
    textareaId,
    textareaRef,
    textareaRows = 1,
    textEditor,
    value,
    ...props
}: ChatComposerProps) {
    const localTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useLayoutEffect(() => {
        const textarea = localTextareaRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';
        const computedStyle = getComputedStyle(textarea);
        const lineHeight = Number.parseFloat(computedStyle.lineHeight);

        if (Number.isNaN(lineHeight)) {
            return;
        }

        const min = lineHeight * textareaRows;
        const max = lineHeight * 8;
        const nextHeight = Math.min(Math.max(textarea.scrollHeight, min), max);

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > max ? 'auto' : 'hidden';
    });

    const setTextareaRef = React.useCallback(
        (element: HTMLTextAreaElement | null) => {
            localTextareaRef.current = element;

            if (typeof textareaRef === 'function') {
                textareaRef(element);
                return;
            }

            if (textareaRef && 'current' in textareaRef) {
                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
                    element;
            }
        },
        [textareaRef]
    );

    const handleContainerMouseDown = React.useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (disabled) {
                return;
            }

            const target = event.target as HTMLElement;

            if (target === localTextareaRef.current) {
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
            if (localTextareaRef.current) {
                localTextareaRef.current.focus();
                return;
            }

            onTextEditorFocus?.();
        },
        [disabled, onTextEditorFocus]
    );

    return (
        <form className={cn('px-6 pt-2 pb-6', className)} {...props}>
            <div className={cn('mx-auto w-full max-w-[46rem]', contentClassName)}>
                {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: The Fluid composer shell focuses its textarea when inert surface space is clicked. */}
                <div
                    className={cn(
                        'relative flex min-h-[6.25rem] cursor-text flex-col justify-between gap-1 rounded-3xl border border-transparent bg-popover p-2 shadow-sm ring-1 ring-border/80',
                        disabled && 'cursor-not-allowed opacity-64',
                        surfaceClassName
                    )}
                    onMouseDown={handleContainerMouseDown}
                >
                    <div className="relative">
                        {textEditor ?? (
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
                                    aria-label={placeholder}
                                    className="w-full"
                                    disabled={disabled}
                                    id={textareaId}
                                    name={name}
                                    onChange={(event) =>
                                        onTextChange(event.target.value, event.target)
                                    }
                                    onClick={onTextSelect}
                                    onKeyDown={onTextKeyDown}
                                    onKeyUp={onTextSelect}
                                    onSelect={onTextSelect}
                                    placeholder={placeholder}
                                    ref={setTextareaRef}
                                    rows={textareaRows}
                                    textareaClassName={cn(
                                        'min-h-0 resize-none bg-transparent px-3 pt-2 pb-0 text-sm leading-6 placeholder:text-muted-foreground/60 max-sm:text-base',
                                        textOverlay &&
                                            'text-transparent caret-foreground selection:bg-ring/25'
                                    )}
                                    unstyled
                                    value={value}
                                />
                            </>
                        )}
                    </div>
                    {composerPopover}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">{footerStart}</div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {footerEnd}
                            <Button
                                aria-label={submitButtonLabel}
                                className={submitButtonClassName}
                                disabled={disabled || !canSubmit}
                                size={submitButtonSize}
                                type="submit"
                            >
                                <Icon icon={ArrowUp02Icon} />
                            </Button>
                        </div>
                    </div>
                </div>
                {error ? <div className="mt-3 px-3 text-destructive text-sm">{error}</div> : null}
            </div>
        </form>
    );
}
