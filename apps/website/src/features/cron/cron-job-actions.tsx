import { Clock, PencilEdit02Icon, PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import type { CronListItem } from './cron-list-data.ts';

interface CronJobActionsProps {
    canEdit: boolean;
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
    return (
        <div className="flex shrink-0 items-center gap-2">
            <Switch
                checked={job.enabled}
                disabled={!canEdit || isToggling}
                onCheckedChange={(checked) => {
                    void onToggle(job, checked);
                }}
            />

            <div className="flex items-center gap-0">
                <Button
                    disabled={false}
                    onClick={() => onHistory(job)}
                    size="icon-sm"
                    title="View run history"
                    type="button"
                    variant="ghost"
                >
                    <Icon className="size-4" icon={Clock} />
                </Button>
                <Button
                    disabled={!canEdit || isRunning}
                    loading={isRunning}
                    onClick={() => {
                        void onRun(job);
                    }}
                    size="icon-sm"
                    title={canEdit ? 'Run now' : 'Start Tavern Runtime to run this automation'}
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
                <Button
                    disabled={!canEdit || isDeleting}
                    loading={isDeleting}
                    onClick={() => {
                        void onDelete(job);
                    }}
                    size="icon-sm"
                    title={
                        canEdit
                            ? 'Delete automation'
                            : 'Start Tavern Runtime to delete this automation'
                    }
                    type="button"
                    variant="ghost"
                >
                    <Icon className="size-4 text-destructive" icon={Trash2} />
                </Button>
            </div>
        </div>
    );
}
