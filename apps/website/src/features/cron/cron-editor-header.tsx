import { Clock, PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { Link } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

interface CronEditorHeaderProps {
    canEdit: boolean;
    canRunActions: boolean;
    isDeleting: boolean;
    isNew: boolean;
    isPending: boolean;
    isRunning: boolean;
    jobName: string | null;
    onDelete: () => void;
    onHistory: () => void;
    onRun: () => void;
}

export function CronEditorHeader({
    canEdit,
    canRunActions,
    isDeleting,
    isNew,
    isPending,
    isRunning,
    jobName,
    onDelete,
    onHistory,
    onRun,
}: CronEditorHeaderProps) {
    return (
        <div className="no-drag relative z-40 flex h-[var(--topbar-height)] items-center gap-2 px-4">
            <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap">
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link to="/dashboard/cron" />}>
                            Automations
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                        <BreadcrumbPage>
                            {isNew ? 'New automation' : (jobName ?? 'Edit automation')}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex shrink-0 items-center gap-2">
                {isNew ? null : (
                    <>
                        <Button
                            onClick={onHistory}
                            size="icon"
                            title="View run history"
                            type="button"
                            variant="secondary"
                        >
                            <Icon icon={Clock} />
                        </Button>
                        <Button
                            disabled={!canRunActions || isDeleting}
                            loading={isDeleting}
                            onClick={onDelete}
                            size="icon"
                            title={
                                canRunActions
                                    ? 'Delete automation'
                                    : 'Connect OpenClaw to delete this automation'
                            }
                            type="button"
                            variant="destructive-outline"
                        >
                            <Icon icon={Trash2} />
                        </Button>
                        <Button
                            disabled={!canRunActions || isRunning}
                            loading={isRunning}
                            onClick={onRun}
                            title={
                                canRunActions
                                    ? 'Run now'
                                    : 'Connect OpenClaw to run this automation'
                            }
                            type="button"
                            variant="secondary"
                        >
                            <Icon icon={PlayIcon} />
                            <span className="hidden sm:inline">Run now</span>
                        </Button>
                    </>
                )}
                <Button disabled={isPending || !canEdit} form="cron-editor-form" type="submit">
                    {isPending ? (
                        'Saving...'
                    ) : isNew ? (
                        <>
                            Create<span className="hidden sm:inline"> automation</span>
                        </>
                    ) : (
                        <>
                            Save<span className="hidden sm:inline"> changes</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
