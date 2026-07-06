import { PlayIcon, Trash2 } from '@hugeicons/core-free-icons';
import { Link } from 'react-router-dom';
import { AppShellContentHeader } from '../../components/ui/app-shell.tsx';
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
import { appRoutes } from '../../lib/app-routes.ts';

interface CronEditorHeaderProps {
    canEdit: boolean;
    canRunActions: boolean;
    isDeleting: boolean;
    isNew: boolean;
    isPending: boolean;
    isRunning: boolean;
    onBack: () => void;
    onDelete: () => void;
    onRun: () => void;
    pageLabel: string;
}

export function CronEditorHeader({
    canEdit,
    canRunActions,
    isDeleting,
    isNew,
    isPending,
    isRunning,
    pageLabel,
    onBack,
    onDelete,
    onRun,
}: CronEditorHeaderProps) {
    return (
        <AppShellContentHeader>
            <Breadcrumb aria-label="Automation breadcrumb" className="flex-1">
                <BreadcrumbList className="min-w-0 flex-nowrap">
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            onClick={(event) => {
                                event.preventDefault();
                                onBack();
                            }}
                            onPointerDown={(event) => {
                                if (event.button !== 0) {
                                    return;
                                }

                                event.preventDefault();
                                onBack();
                            }}
                            render={<Link to={appRoutes.automations} />}
                            title="Back to automations"
                        >
                            Automations
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                        <BreadcrumbPage className="min-w-0 truncate" title={pageLabel}>
                            {pageLabel}
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex shrink-0 items-center gap-2">
                {isNew ? null : (
                    <>
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
                <Button disabled={isPending || !canEdit} form="cron-editor-form" type="submit">
                    {isPending ? (
                        'Saving...'
                    ) : isNew ? (
                        <span>
                            Create<span className="hidden sm:inline"> automation</span>
                        </span>
                    ) : (
                        <span>
                            Save<span className="hidden sm:inline"> changes</span>
                        </span>
                    )}
                </Button>
            </div>
        </AppShellContentHeader>
    );
}
