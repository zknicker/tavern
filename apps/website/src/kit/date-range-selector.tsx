import { ArrowRight02Icon, Calendar03Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '../components/ui/calendar.tsx';
import { Icon } from '../components/ui/icon.tsx';
import { Popover, PopoverPopup, PopoverTrigger } from '../components/ui/popover.tsx';
import { Button } from '../components/ui/primitives/button.tsx';
import { cn } from '../lib/utils.ts';
import {
    addDays,
    endOfMonth,
    formatDateRangeEndpoint,
    formatIsoDate,
    parseIsoDate,
    startOfMonth,
} from './iso-date.ts';

export function KitDateRangeSelector({
    disabled = false,
    endDate,
    onRangeChange,
    startDate,
}: {
    disabled?: boolean;
    endDate: string;
    onRangeChange(startDate: string, endDate: string): void;
    startDate: string;
}) {
    const [open, setOpen] = useState(false);
    const committedRange = useMemo<CompleteDateRange>(
        () => ({
            from: parseIsoDate(startDate),
            to: parseIsoDate(endDate),
        }),
        [endDate, startDate]
    );
    const [draftRange, setDraftRange] = useState<DateRange | undefined>(committedRange);
    const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(committedRange.from));
    const [today, setToday] = useState(() => new Date());

    useEffect(() => {
        setDraftRange(committedRange);
        setVisibleMonth(startOfMonth(committedRange.from));
    }, [committedRange]);

    useEffect(() => {
        if (disabled) {
            setOpen(false);
        }
    }, [disabled]);

    const handleSelect = (range: DateRange | undefined) => {
        setDraftRange(range);

        if (!(range?.from && range.to)) {
            return;
        }

        commitRange({ from: range.from, to: range.to });
    };

    const commitRange = (range: CompleteDateRange) => {
        const nextStartDate = formatIsoDate(range.from);
        const nextEndDate = formatIsoDate(range.to);
        const [normalizedStartDate, normalizedEndDate] =
            nextStartDate <= nextEndDate
                ? [nextStartDate, nextEndDate]
                : [nextEndDate, nextStartDate];

        onRangeChange(normalizedStartDate, normalizedEndDate);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (disabled) {
            setOpen(false);
            return;
        }

        setOpen(nextOpen);

        if (nextOpen) {
            setToday(new Date());
            setDraftRange(committedRange);
            setVisibleMonth(startOfMonth(committedRange.from));
        }
    };

    const handlePreset = (preset: RangePreset) => {
        const range = preset.range(today);
        setDraftRange(range);
        setVisibleMonth(startOfMonth(range.from));
        commitRange(range);
        setOpen(false);
    };

    return (
        <Popover onOpenChange={handleOpenChange} open={open}>
            <PopoverTrigger
                render={
                    <Button
                        className="h-8 max-w-72 justify-start rounded-md px-2 text-left font-normal text-sm shadow-none hover:bg-accent/50 data-pressed:bg-accent/50"
                        disabled={disabled}
                        variant="ghost"
                    />
                }
            >
                <Icon
                    className="size-4.5 text-muted-foreground opacity-80"
                    icon={Calendar03Icon}
                    strokeWidth={1.8}
                />
                <span>{formatDateRangeEndpoint(startDate)}</span>
                <Icon className="size-3.5 text-muted-foreground" icon={ArrowRight02Icon} />
                <span>{formatDateRangeEndpoint(endDate)}</span>
            </PopoverTrigger>
            <PopoverPopup
                align="end"
                className="w-auto p-0 [--viewport-inline-padding:--spacing(0)] [&_[data-slot=popover-viewport]]:py-0"
                sideOffset={6}
            >
                <div className="flex flex-col sm:flex-row">
                    <div className="flex gap-0.5 border-border/70 border-b p-1 sm:w-32 sm:flex-col sm:border-r sm:border-b-0">
                        {rangePresets.map((preset) => (
                            <Button
                                className={cn(
                                    'h-7 justify-start rounded-md px-1.5 font-normal text-sm focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-offset-0 sm:w-full',
                                    presetIsActive(preset, today, startDate, endDate) &&
                                        'bg-accent text-foreground'
                                )}
                                key={preset.id}
                                onClick={() => handlePreset(preset)}
                                size="sm"
                                variant="ghost"
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                    <Calendar
                        className="p-2"
                        mode="range"
                        month={visibleMonth}
                        numberOfMonths={2}
                        onMonthChange={setVisibleMonth}
                        onSelect={handleSelect}
                        pagedNavigation={true}
                        resetOnSelect={true}
                        selected={draftRange}
                    />
                </div>
            </PopoverPopup>
        </Popover>
    );
}

interface CompleteDateRange {
    from: Date;
    to: Date;
}

interface RangePreset {
    id: string;
    label: string;
    range(today: Date): CompleteDateRange;
}

const rangePresets: RangePreset[] = [
    { id: '7d', label: '7d', range: (today) => daysEndingToday(today, 7) },
    { id: '14d', label: '14d', range: (today) => daysEndingToday(today, 14) },
    { id: '30d', label: '30d', range: (today) => daysEndingToday(today, 30) },
    {
        id: 'this-month',
        label: 'This Month',
        range: (today) => ({ from: startOfMonth(today), to: today }),
    },
    {
        id: 'last-month',
        label: 'Last Month',
        range: (today) => {
            const lastMonth = addDays(startOfMonth(today), -1);
            return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        },
    },
];

function daysEndingToday(today: Date, days: number): CompleteDateRange {
    return { from: addDays(today, -(days - 1)), to: today };
}

function presetIsActive(preset: RangePreset, today: Date, startDate: string, endDate: string) {
    const range = preset.range(today);
    return formatIsoDate(range.from) === startDate && formatIsoDate(range.to) === endDate;
}
