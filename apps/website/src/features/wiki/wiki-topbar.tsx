import type { IconSvgElement } from '@hugeicons/react';
import {
    EyeIcon,
    File01Icon,
    FileEditIcon,
    Folder01Icon,
    InputLongTextIcon,
    LayoutTwoColumnIcon,
    PanelRightCloseIcon,
    PanelRightOpenIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Fragment } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { TabItem, Tabs, TabsList } from '../../components/ui/tabs.tsx';
import { Tooltip } from '../../components/ui/tooltip.tsx';

export type WikiEditorMode = 'edit' | 'preview' | 'split';

export function WikiTopbar({
    canSave,
    editorMode,
    inspectorOpen,
    isSaving,
    onEditorModeChange,
    onInspectorOpenChange,
    onSelectPath,
    onSave,
    pagePath,
    pageSelected,
}: {
    canSave: boolean;
    editorMode: WikiEditorMode;
    inspectorOpen: boolean;
    isSaving: boolean;
    onEditorModeChange: (mode: WikiEditorMode) => void;
    onInspectorOpenChange: (open: boolean) => void;
    onSelectPath: (path: string) => void;
    onSave: () => void;
    pagePath: string;
    pageSelected: boolean;
}) {
    return (
        <header className="grid h-[var(--content-topbar-height)] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-[var(--content-card-border)] border-b">
            <div className="min-w-0 px-4">
                {pagePath ? (
                    <WikiPathBreadcrumb onSelectPath={onSelectPath} path={pagePath} />
                ) : null}
            </div>
            {pageSelected ? (
                <div className="flex items-center justify-end gap-3 py-0 pr-[10px] pl-4">
                    <Button
                        disabled={!canSave}
                        loading={isSaving}
                        onClick={onSave}
                        size="sm"
                        variant={canSave ? 'default' : 'secondary'}
                    >
                        <Icon icon={FileEditIcon} />
                        Save
                    </Button>
                    <Tabs
                        onValueChange={(value) => onEditorModeChange(value as WikiEditorMode)}
                        value={editorMode}
                    >
                        <TabsList>
                            <TabItem icon={InputLongTextIcon} iconOnly label="Edit" value="edit" />
                            <TabItem
                                icon={LayoutTwoColumnIcon}
                                iconOnly
                                label="Split"
                                value="split"
                            />
                            <TabItem icon={EyeIcon} iconOnly label="Preview" value="preview" />
                        </TabsList>
                    </Tabs>
                    <ModeButton
                        active={inspectorOpen}
                        icon={inspectorOpen ? PanelRightCloseIcon : PanelRightOpenIcon}
                        label="Metadata"
                        onClick={() => onInspectorOpenChange(!inspectorOpen)}
                    />
                </div>
            ) : null}
        </header>
    );
}

function WikiPathBreadcrumb({
    onSelectPath,
    path,
}: {
    onSelectPath: (path: string) => void;
    path: string;
}) {
    const crumbs = path
        .split('/')
        .filter(Boolean)
        .map((segment, index, segments) => ({
            isCurrentPage: index === segments.length - 1,
            isFirst: index === 0,
            label: segment,
            path: segments.slice(0, index + 1).join('/'),
        }));

    if (crumbs.length === 0) {
        return null;
    }

    return (
        <Breadcrumb aria-label="Wiki path" className="min-w-0" title={path}>
            <BreadcrumbList className="min-w-0 flex-nowrap gap-1.5 overflow-hidden text-sm sm:gap-1.5">
                {crumbs.map((crumb) => (
                    <Fragment key={crumb.path}>
                        {crumb.isFirst ? null : (
                            <BreadcrumbSeparator className="shrink-0 opacity-45 [&>svg]:size-3.5" />
                        )}
                        <BreadcrumbItem
                            className={
                                crumb.isCurrentPage
                                    ? 'min-w-0 max-w-[18rem]'
                                    : 'min-w-0 max-w-[8rem]'
                            }
                        >
                            {crumb.isCurrentPage ? (
                                <BreadcrumbPage className="flex min-w-0 items-center gap-1 font-medium">
                                    <Icon
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0"
                                        icon={File01Icon}
                                    />
                                    <span className="truncate">{crumb.label}</span>
                                </BreadcrumbPage>
                            ) : (
                                <button
                                    className="-my-1 flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                                    onClick={() => onSelectPath(crumb.path)}
                                    type="button"
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0"
                                        icon={Folder01Icon}
                                    />
                                    <span className="truncate">{crumb.label}</span>
                                </button>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

function ModeButton({
    active,
    icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: IconSvgElement;
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip content={label}>
            <Button
                aria-label={label}
                onClick={onClick}
                size="icon-sm"
                variant={active ? 'secondary' : 'ghost'}
            >
                <Icon icon={icon} />
            </Button>
        </Tooltip>
    );
}
