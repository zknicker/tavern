import type * as React from 'react';
import { Field, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Label } from '../../../components/ui/primitives/label.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import type { CronEditorSelectOption } from './use-cron-editor-options.ts';

interface CronSelectFieldProps {
    emptyText?: string;
    fieldClassName?: string;
    label: string;
    onValueChange: (value: string) => void;
    options: CronEditorSelectOption[];
    placeholder?: string;
    size?: NonNullable<React.ComponentProps<typeof SelectTrigger>['size']>;
    value: string;
}

type CronSelectSize = NonNullable<React.ComponentProps<typeof SelectTrigger>['size']>;

export function CronSelectField({
    emptyText = 'No options available',
    fieldClassName,
    label,
    onValueChange,
    options,
    placeholder = 'Select an option',
    size = 'default',
    value,
}: CronSelectFieldProps) {
    const selectedOption = options.find((option) => option.value === value) ?? null;

    if (options.length === 0) {
        return (
            <Field className={fieldClassName}>
                <FieldLabel>{label}</FieldLabel>
                <Input disabled placeholder={emptyText} size={size} value="" />
            </Field>
        );
    }

    return (
        <Field className={fieldClassName}>
            <FieldLabel>{label}</FieldLabel>
            <Select
                onValueChange={(nextValue) => {
                    if (nextValue !== null) {
                        onValueChange(nextValue);
                    }
                }}
                value={value}
            >
                <SelectTrigger size={size}>
                    <SelectValue placeholder={placeholder}>{selectedOption?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    );
}

export function CronSelectRow({
    emptyText = 'No options available',
    label,
    onValueChange,
    options,
    placeholder = 'Select an option',
    size = 'sm',
    value,
}: Omit<CronSelectFieldProps, 'fieldClassName'> & {
    size?: CronSelectSize;
}) {
    const selectedOption = options.find((option) => option.value === value) ?? null;

    if (options.length === 0) {
        return (
            <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <Input
                    className="max-w-[12rem]"
                    disabled
                    placeholder={emptyText}
                    size={size}
                    value=""
                />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <Label className="text-muted-foreground">{label}</Label>
            <Select
                onValueChange={(nextValue) => {
                    if (nextValue !== null) {
                        onValueChange(nextValue);
                    }
                }}
                value={value}
            >
                <SelectTrigger className="max-w-[12rem]" size={size}>
                    <SelectValue placeholder={placeholder}>{selectedOption?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
