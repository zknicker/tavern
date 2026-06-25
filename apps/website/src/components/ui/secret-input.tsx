import { EyeIcon, EyeOff } from '@hugeicons-pro/core-stroke-rounded';
import type { KeyboardEventHandler } from 'react';
import { Icon } from './icon.tsx';
import { Button } from './primitives/button.tsx';
import { Input } from './primitives/input.tsx';

// Shared masked-secret field: mono input with a reveal toggle. Used for env
// variables, plugin API keys, and anywhere a secret is entered or edited.
export function SecretInput({
    ariaLabel,
    disabled,
    name,
    onChange,
    onKeyDown,
    onRevealToggle,
    placeholder,
    revealed,
    value,
}: {
    ariaLabel: string;
    disabled: boolean;
    name: string;
    onChange: (value: string) => void;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
    onRevealToggle: () => void;
    placeholder?: string;
    revealed: boolean;
    value: string;
}) {
    return (
        <div className="relative min-w-0">
            <Input
                aria-label={ariaLabel}
                autoComplete="off"
                className="font-mono [&_input]:pe-9"
                disabled={disabled}
                name={name}
                nativeInput
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                spellCheck={false}
                type={revealed ? 'text' : 'password'}
                value={value}
            />
            <Button
                aria-label={revealed ? `Hide ${ariaLabel}` : `Reveal ${ariaLabel}`}
                className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground/75 hover:text-foreground"
                disabled={disabled || value.length === 0}
                onClick={onRevealToggle}
                size="icon-xs"
                title={revealed ? `Hide ${ariaLabel}` : `Reveal ${ariaLabel}`}
                variant="ghost"
            >
                <Icon icon={revealed ? EyeOff : EyeIcon} />
            </Button>
        </div>
    );
}
