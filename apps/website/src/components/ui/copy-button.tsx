'use client';

import { Tick02Icon } from '@hugeicons-pro/core-solid-rounded';
import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { writeClipboardText } from '../../lib/clipboard.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button, type ButtonProps } from './primitives/button.tsx';

interface CopyButtonProps extends Omit<ButtonProps, 'children' | 'onClick'> {
    copiedLabel?: string;
    label?: string;
    onCopy?: () => void;
    value: string;
}

export function CopyButton({
    className,
    copiedLabel = 'Copied',
    disabled,
    label = 'Copy',
    onCopy,
    size = 'icon-xs',
    value,
    variant = 'ghost',
    ...props
}: CopyButtonProps) {
    const [copied, setCopied] = React.useState(false);
    const copyValue = value.trim();
    const canCopy = copyValue.length > 0;

    React.useEffect(() => {
        if (!copied) {
            return;
        }

        const id = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(id);
    }, [copied]);

    return (
        <Button
            aria-label={copied ? copiedLabel : label}
            className={cn('text-muted-foreground/75 hover:text-foreground', className)}
            disabled={disabled || !canCopy}
            onClick={async () => {
                try {
                    await writeClipboardText(copyValue);
                    setCopied(true);
                    onCopy?.();
                } catch {
                    setCopied(false);
                }
            }}
            size={size}
            title={copied ? copiedLabel : label}
            variant={variant}
            {...props}
        >
            <Icon icon={copied ? Tick02Icon : Copy01Icon} />
        </Button>
    );
}
