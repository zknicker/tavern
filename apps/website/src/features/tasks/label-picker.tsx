import {
    Add01Icon,
    Cancel01Icon,
    Settings01Icon,
    Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Popover, PopoverPopup, PopoverTrigger } from '../../components/ui/popover.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { useLabelList } from '../../hooks/labels/use-label-list.ts';
import type { LabelRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { LabelChip, LabelDot } from './label-chip.tsx';
import { fallbackLabelColor } from './label-colors.ts';
import { ManageLabelsDialog } from './manage-labels-dialog.tsx';

// Multi-select over the label catalog. Selection is by name (string[]); unknown
// names auto-create server-side when the task mutation saves. Resolves colors
// from the catalog for chips and rows.
export function LabelPicker({
    disabled = false,
    labels,
    onChange,
}: {
    disabled?: boolean;
    labels: string[];
    onChange: (labels: string[]) => void;
}) {
    const labelsQuery = useLabelList();
    const catalog = labelsQuery.data?.labels ?? [];
    const byName = React.useMemo(
        () => new Map(catalog.map((label) => [label.name.toLowerCase(), label])),
        [catalog]
    );

    const remove = (name: string) => {
        onChange(labels.filter((candidate) => candidate !== name));
    };

    return (
        <div className="grid gap-2">
            {labels.length > 0 ? (
                <ul className="flex flex-wrap gap-1">
                    {labels.map((name) => {
                        const color = byName.get(name.toLowerCase())?.color ?? fallbackLabelColor;

                        return (
                            <li className="flex" key={name}>
                                <span className="inline-flex items-center gap-0.5">
                                    <LabelChip color={color} name={name} />
                                    <button
                                        aria-label={`Remove ${name}`}
                                        className="rounded-sm p-0.5 text-muted-foreground/60 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                                        disabled={disabled}
                                        onClick={() => remove(name)}
                                        type="button"
                                    >
                                        <Icon className="size-3" icon={Cancel01Icon} />
                                    </button>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
            <div>
                <LabelPickerPopover
                    catalog={catalog}
                    disabled={disabled}
                    onChange={onChange}
                    selected={labels}
                />
            </div>
        </div>
    );
}

function LabelPickerPopover({
    catalog,
    disabled,
    onChange,
    selected,
}: {
    catalog: LabelRecord[];
    disabled: boolean;
    onChange: (labels: string[]) => void;
    selected: string[];
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [manageOpen, setManageOpen] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setQuery('');
        }
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();
    const selectedSet = new Set(selected.map((name) => name.toLowerCase()));
    const visible = normalizedQuery
        ? catalog.filter((label) => label.name.toLowerCase().includes(normalizedQuery))
        : catalog;
    const trimmed = query.trim();
    const hasExact = catalog.some((label) => label.name.toLowerCase() === normalizedQuery);
    const showCreate = trimmed.length > 0 && !hasExact;

    const toggle = (name: string) => {
        if (selectedSet.has(name.toLowerCase())) {
            onChange(
                selected.filter((candidate) => candidate.toLowerCase() !== name.toLowerCase())
            );
        } else {
            onChange([...selected, name]);
        }
    };

    const create = () => {
        onChange([...selected, trimmed]);
        setQuery('');
    };

    return (
        <>
            <Popover onOpenChange={setOpen} open={open}>
                <PopoverTrigger
                    render={<Button disabled={disabled} size="sm" type="button" variant="ghost" />}
                >
                    <Icon data-icon="inline-start" icon={Add01Icon} />
                    Add label
                </PopoverTrigger>
                <PopoverPopup
                    align="start"
                    className="w-[min(19rem,calc(100vw-2rem))] overflow-hidden py-0 [--viewport-inline-padding:--spacing(0)] [&_[data-slot=popover-viewport]]:p-0"
                    sideOffset={8}
                >
                    <div className="sticky top-0 z-10 border-b bg-popover">
                        <SearchInput
                            aria-label="Search labels"
                            className="[&_[data-slot=input-control]]:h-10 [&_[data-slot=input-control]]:rounded-none [&_[data-slot=input-control]]:border-0 [&_[data-slot=input-control]]:bg-transparent [&_[data-slot=input-control]]:shadow-none [&_[data-slot=input-control]]:has-focus-visible:ring-0"
                            name="label-search"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search or create labels..."
                            value={query}
                        />
                    </div>
                    <div className="max-h-[min(18rem,calc(100dvh-10rem))] overflow-y-auto">
                        {showCreate ? (
                            <button
                                className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent/30 focus-visible:bg-accent/30"
                                onClick={create}
                                type="button"
                            >
                                <Icon className="size-4 text-muted-foreground" icon={Add01Icon} />
                                <span className="truncate text-foreground text-sm">
                                    Create "{trimmed}"
                                </span>
                            </button>
                        ) : null}
                        {visible.length > 0 ? (
                            <ul className={cn(showCreate && 'border-t')}>
                                {visible.map((label) => {
                                    const isSelected = selectedSet.has(label.name.toLowerCase());

                                    return (
                                        <li key={label.id}>
                                            <button
                                                aria-pressed={isSelected}
                                                className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-accent/30 focus-visible:bg-accent/30"
                                                onClick={() => toggle(label.name)}
                                                type="button"
                                            >
                                                <LabelDot color={label.color} />
                                                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                                                    {label.name}
                                                </span>
                                                {isSelected ? (
                                                    <Icon
                                                        className="size-4 text-muted-foreground"
                                                        icon={Tick02Icon}
                                                    />
                                                ) : null}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : showCreate ? null : (
                            <p className="px-3 py-4 text-muted-foreground text-sm">
                                No labels yet.
                            </p>
                        )}
                    </div>
                    <div className="border-t">
                        <button
                            className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground text-sm outline-none hover:bg-accent/30 hover:text-foreground focus-visible:bg-accent/30"
                            onClick={() => {
                                setOpen(false);
                                setManageOpen(true);
                            }}
                            type="button"
                        >
                            <Icon className="size-4" icon={Settings01Icon} />
                            Manage labels
                        </button>
                    </div>
                </PopoverPopup>
            </Popover>
            <ManageLabelsDialog onOpenChange={setManageOpen} open={manageOpen} />
        </>
    );
}
