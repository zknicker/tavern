import { Calendar03Icon, Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Calendar } from '../../components/ui/calendar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Popover, PopoverPopup, PopoverTrigger } from '../../components/ui/popover.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { TaskEditorSection } from './task-editor-sidebar.tsx';
import { TaskFieldRow } from './task-fields.tsx';
import { formatScheduledForShort } from './task-presentation.ts';

interface TaskScheduleProps {
    disabled?: boolean;
    onChange: (scheduledFor: string | null) => void;
    // A YYYY-MM-DD date, or null when the task is not scheduled.
    value: string | null;
}

// The earliest date a task should be worked. Sends YYYY-MM-DD, clearable to
// null. Scheduling gates dispatch, never triage.
export function TaskSchedule({ disabled = false, onChange, value }: TaskScheduleProps) {
    const [open, setOpen] = React.useState(false);
    const selected = value ? parseIsoDate(value) : undefined;

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            onChange(formatIsoDate(date));
        }

        setOpen(false);
    };

    return (
        <TaskEditorSection title="Schedule">
            <TaskFieldRow label="Scheduled">
                <div className="flex max-w-[12rem] items-center gap-1">
                    <Popover onOpenChange={setOpen} open={open}>
                        <PopoverTrigger
                            render={
                                <Button
                                    className="h-8 min-w-0 flex-1 justify-start rounded-md px-2 font-normal"
                                    disabled={disabled}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                />
                            }
                        >
                            <Icon
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted-foreground"
                                icon={Calendar03Icon}
                            />
                            <span className="truncate">
                                {value ? (
                                    formatScheduledForShort(value)
                                ) : (
                                    <span className="text-muted-foreground">Not scheduled</span>
                                )}
                            </span>
                        </PopoverTrigger>
                        <PopoverPopup
                            align="end"
                            className="w-auto p-0 [--viewport-inline-padding:--spacing(0)] [&_[data-slot=popover-viewport]]:py-0"
                            sideOffset={6}
                        >
                            <Calendar
                                className="p-2"
                                mode="single"
                                onSelect={handleSelect}
                                selected={selected}
                            />
                        </PopoverPopup>
                    </Popover>
                    {value ? (
                        <Button
                            aria-label="Clear schedule"
                            className="size-8 shrink-0 rounded-md text-muted-foreground/60 hover:text-foreground"
                            disabled={disabled}
                            onClick={() => onChange(null)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon className="size-3.5" icon={Cancel01Icon} />
                        </Button>
                    ) : null}
                </div>
            </TaskFieldRow>
        </TaskEditorSection>
    );
}

// scheduledFor is date-only. Parse and format at local midnight so the picked
// calendar day round-trips without a UTC shift.
function parseIsoDate(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

function formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
