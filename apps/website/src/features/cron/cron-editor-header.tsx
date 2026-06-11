import { Clock, PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { AppShellContentHeader } from '../../components/ui/app-shell.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

interface CronEditorHeaderProps {
    canEdit: boolean;
    canRunActions: boolean;
    isDeleting: boolean;
    isManaged: boolean;
    isNew: boolean;
    isPending: boolean;
    isRunning: boolean;
    onDelete: () => void;
    onHistory: () => void;
    onRun: () => void;
}

export function CronEditorHeader({
    canEdit,
    canRunActions,
    isDeleting,
    isManaged,
    isNew,
    isPending,
    isRunning,
    onDelete,
    onHistory,
    onRun,
}: CronEditorHeaderProps) {
    return (
        <AppShellContentHeader>
            <div className="ml-auto flex shrink-0 items-center gap-2">
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
                        {isManaged ? null : (
                            <Button
                                disabled={!canRunActions || isDeleting}
                                loading={isDeleting}
                                onClick={onDelete}
                                size="icon"
                                title={
                                    canRunActions
                                        ? 'Delete automation'
                                        : 'Agent engine offline — reconnect to delete this automation'
                                }
                                type="button"
                                variant="destructive-outline"
                            >
                                <Icon icon={Trash2} />
                            </Button>
                        )}
                        <Button
                            disabled={!canRunActions || isRunning}
                            loading={isRunning}
                            onClick={onRun}
                            title={
                                canRunActions
                                    ? 'Run now'
                                    : 'Agent engine offline — reconnect to run this automation'
                            }
                            type="button"
                            variant="secondary"
                        >
                            <Icon icon={PlayIcon} />
                            <span className="hidden sm:inline">Run now</span>
                        </Button>
                    </>
                )}
                {isManaged ? null : (
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
                )}
            </div>
        </AppShellContentHeader>
    );
}
