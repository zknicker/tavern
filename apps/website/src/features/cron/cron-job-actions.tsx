import { Clock, PencilEdit02Icon, PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { MoreHorizontalIcon, PauseIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { cn } from '../../lib/utils.ts';
import type { CronListItem } from './cron-list-data.ts';

interface CronJobActionsProps {
    canEdit: boolean;
    className?: string;
    isDeleting: boolean;
    isRunning: boolean;
    isToggling: boolean;
    job: CronListItem;
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onHistory: (job: CronListItem) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
}

export function CronJobActions({
    canEdit,
    className,
    isDeleting,
    isRunning,
    isToggling,
    job,
    onDelete,
    onEdit,
    onHistory,
    onRun,
    onToggle,
}: CronJobActionsProps) {
    const toggleLabel = job.enabled ? 'Pause' : 'Enable';
    const toggleTitle = canEdit
        ? `${toggleLabel} automation`
        : `Start Grotto Runtime to ${toggleLabel.toLowerCase()} this automation`;

    return (
        <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
            <Button
                disabled={!canEdit || isRunning}
                loading={isRunning}
                onClick={() => {
                    void onRun(job);
                }}
                size="icon-sm"
                title={canEdit ? 'Run now' : 'Start Grotto Runtime to run this automation'}
                type="button"
                variant="ghost"
            >
                <Icon className="size-4" icon={PlayIcon} />
            </Button>
            <Button
                disabled={false}
                onClick={() => onEdit(job)}
                size="icon-sm"
                title="Edit automation"
                type="button"
                variant="ghost"
            >
                <Icon className="size-4" icon={PencilEdit02Icon} />
            </Button>
            <Menu>
                <MenuTrigger
                    render={
                        <Button
                            aria-label={`${job.name} actions`}
                            size="icon-sm"
                            title="Automation actions"
                            variant="ghost"
                        />
                    }
                >
                    <Icon className="size-4" icon={MoreHorizontalIcon} />
                </MenuTrigger>
                <MenuPopup align="end">
                    <MenuItem onClick={() => onHistory(job)}>
                        <Icon className="size-4" icon={Clock} />
                        Run history
                    </MenuItem>
                    <MenuItem
                        disabled={!canEdit || isRunning}
                        onClick={() => {
                            void onRun(job);
                        }}
                    >
                        <Icon className="size-4" icon={PlayIcon} />
                        Run now
                    </MenuItem>
                    <MenuItem
                        disabled={!canEdit || isToggling}
                        onClick={() => {
                            void onToggle(job, !job.enabled);
                        }}
                        title={toggleTitle}
                    >
                        <Icon className="size-4" icon={job.enabled ? PauseIcon : PlayIcon} />
                        {toggleLabel}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem onClick={() => onEdit(job)}>
                        <Icon className="size-4" icon={PencilEdit02Icon} />
                        Edit
                    </MenuItem>
                    <MenuItem
                        disabled={!canEdit || isDeleting}
                        onClick={() => {
                            void onDelete(job);
                        }}
                        variant="destructive"
                    >
                        <Icon className="size-4" icon={Trash2} />
                        Delete
                    </MenuItem>
                </MenuPopup>
            </Menu>
        </div>
    );
}
