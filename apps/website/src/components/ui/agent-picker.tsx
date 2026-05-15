import { AgentAvatar } from '@tavern/agent-avatars';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.tsx';

export interface AgentOptionItem {
    avatar: string;
    color: string;
    idLabel: string;
    summary: string;
    title: string;
    value: string;
}

type AgentPickerSize = NonNullable<React.ComponentProps<typeof SelectTrigger>['size']>;

const agentPickerTriggerSizeClassName = {
    default: 'min-h-14 py-2',
    lg: 'min-h-16 py-2.5',
    sm: 'min-h-12 py-1.5',
} satisfies Record<AgentPickerSize, string>;

const agentPickerAvatarClassName = {
    default: 'size-8',
    lg: 'size-10',
    sm: 'size-7',
} satisfies Record<AgentPickerSize, string>;

const agentPickerPlaceholder = {
    avatar: '',
    color: '#64748b',
    idLabel: 'required',
    summary: 'Select an agent to run this automation prompt.',
    title: 'Choose agent',
    value: '',
} satisfies AgentOptionItem;

function AgentSelectionCard({
    className,
    option,
    size = 'default',
}: {
    className?: string;
    option: AgentOptionItem;
    size?: AgentPickerSize;
}) {
    const isCompact = size === 'sm';

    return (
        <div
            className={cn(
                'flex min-w-0 items-center text-left',
                isCompact ? 'gap-2' : 'gap-3',
                className
            )}
        >
            <AgentAvatar
                avatar={option.avatar}
                backgroundColor={option.color}
                className={cn('shrink-0', agentPickerAvatarClassName[size])}
                name={option.title}
            />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{option.title}</div>
                <div
                    className={cn(
                        'truncate text-muted-foreground',
                        isCompact ? 'text-meta' : 'text-sm'
                    )}
                >
                    {option.idLabel}
                </div>
                {isCompact ? null : (
                    <div className="mt-0.5 truncate text-meta text-muted-foreground">
                        {option.summary}
                    </div>
                )}
            </div>
        </div>
    );
}

export function AgentPicker({
    options,
    value,
    onSelect,
    size = 'default',
}: {
    onSelect: (value: string) => void;
    options: AgentOptionItem[];
    size?: AgentPickerSize;
    value: string;
}) {
    const selectedOption = options.find((option) => option.value === value);
    const triggerOption = selectedOption ?? agentPickerPlaceholder;

    const handleValueChange = (nextValue: string | null) => {
        if (nextValue !== null) {
            onSelect(nextValue);
        }
    };

    return (
        <Select
            aria-label="Select agent"
            onValueChange={handleValueChange}
            value={selectedOption?.value}
        >
            <SelectTrigger
                className={cn('h-auto w-full max-w-[600px]', agentPickerTriggerSizeClassName[size])}
                size={size}
            >
                <SelectValue>
                    <AgentSelectionCard option={triggerOption} size={size} />
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-[26rem] max-w-[calc(100vw-2rem)]">
                {options.map((option) => (
                    <SelectItem
                        className="min-h-12 grid-cols-[1rem_1fr] py-1.5 ps-2 pe-3"
                        key={option.value || '__default__'}
                        value={option.value}
                    >
                        <AgentSelectionCard option={option} size={size} />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
