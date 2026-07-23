import { CancelCircleIcon, Clock } from '@hugeicons/core-free-icons';
import { MoreHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { cn } from '../../lib/utils.ts';
import type { ReminderListItem } from './reminder-list-data.ts';

interface ReminderActionsProps {
    className?: string;
    isCanceling: boolean;
    onCancel: (reminder: ReminderListItem) => void;
    onHistory: (reminder: ReminderListItem) => void;
    reminder: ReminderListItem;
}

// Ported from cron-job-actions.tsx, reduced to the two live affordances.
// Reminders are agent-authored and server-scheduled, so run-now / edit /
// pause are concept-dead (D4); Cancel replaces Delete and only applies while
// the reminder is still scheduled.
export function ReminderActions({
    className,
    isCanceling,
    onCancel,
    onHistory,
    reminder,
}: ReminderActionsProps) {
    const canCancel = reminder.status === 'scheduled';

    return (
        <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
            <Menu>
                <MenuTrigger
                    render={
                        <Button
                            aria-label={`${reminder.name} actions`}
                            size="icon-sm"
                            title="Reminder actions"
                            variant="ghost"
                        />
                    }
                >
                    <Icon className="size-4" icon={MoreHorizontalIcon} />
                </MenuTrigger>
                <MenuPopup align="end">
                    <MenuItem onClick={() => onHistory(reminder)}>
                        <Icon className="size-4" icon={Clock} />
                        Run history
                    </MenuItem>
                    <MenuItem
                        disabled={!canCancel || isCanceling}
                        onClick={() => onCancel(reminder)}
                        variant="destructive"
                    >
                        <Icon className="size-4" icon={CancelCircleIcon} />
                        Cancel
                    </MenuItem>
                </MenuPopup>
            </Menu>
        </div>
    );
}
