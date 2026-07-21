import { PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

interface CronEditorActionsProps {
    canEdit: boolean;
    canRunActions: boolean;
    isDeleting: boolean;
    isNew: boolean;
    isPending: boolean;
    isRunning: boolean;
    onDelete: () => void;
    onRun: () => void;
}

export function CronEditorActions({
    canEdit,
    canRunActions,
    isDeleting,
    isNew,
    isPending,
    isRunning,
    onDelete,
    onRun,
}: CronEditorActionsProps) {
    return (
        <div className="flex shrink-0 items-center justify-end gap-2">
            {isNew ? null : (
                <>
                    <Button
                        disabled={!canRunActions || isDeleting}
                        loading={isDeleting}
                        onClick={onDelete}
                        size="icon"
                        title={
                            canRunActions
                                ? 'Delete reminder'
                                : 'Agent engine offline — reconnect to delete this reminder'
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
                                : 'Agent engine offline — reconnect to run this reminder'
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
                    <span>
                        Create<span className="hidden sm:inline"> reminder</span>
                    </span>
                ) : (
                    <span>
                        Save<span className="hidden sm:inline"> changes</span>
                    </span>
                )}
            </Button>
        </div>
    );
}
