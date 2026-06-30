import {
    Copy01Icon,
    File01Icon,
    Folder01Icon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { formatTavernResourceLink, type TavernResourceTarget } from './tavern-resource-link.ts';

export function ArtifactPanelPathBar({
    onOpenTarget,
    target,
}: {
    onOpenTarget: (target: TavernResourceTarget) => void;
    target: TavernResourceTarget;
}) {
    const navigate = useNavigate();
    const openHref = getArtifactPanelOpenHref(target);
    const openDisabled = openHref === null;

    const openTarget = () => {
        if (!openHref) {
            return;
        }

        navigate(openHref);
    };
    const copyTavernLink = () => void copyArtifactText(formatTavernResourceLink(target));
    const copyPath = () => void copyArtifactText(target.path);

    return (
        <div className="flex h-9 items-center justify-between gap-2 border-border/45 border-t px-4">
            <ArtifactPanelBreadcrumb onOpenTarget={onOpenTarget} target={target} />
            <div className="flex shrink-0 items-center gap-1">
                <Menu>
                    <MenuTrigger
                        aria-label="Artifact options"
                        className={artifactPanelChromeButtonClassName}
                    >
                        <Icon className="size-3.5" icon={MoreHorizontalIcon} />
                    </MenuTrigger>
                    <MenuPopup align="end" className="w-44">
                        <MenuItem disabled={openDisabled} onClick={openTarget}>
                            <Icon icon={File01Icon} />
                            Open source
                        </MenuItem>
                        <MenuItem onClick={copyTavernLink}>
                            <Icon icon={Copy01Icon} />
                            Copy link
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem onClick={copyPath}>Copy path</MenuItem>
                    </MenuPopup>
                </Menu>
                <button
                    className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2.5 font-medium text-[0.8125rem] text-foreground shadow-black/4 shadow-sm transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-56"
                    disabled={openDisabled}
                    onClick={openTarget}
                    title={
                        openDisabled
                            ? 'No source view is available for this artifact yet'
                            : 'Open source'
                    }
                    type="button"
                >
                    <Icon className="size-3.5 text-muted-foreground" icon={File01Icon} />
                    Open
                </button>
                <ArtifactPanelChromeButton aria-label="Copy artifact link" onClick={copyTavernLink}>
                    <Icon className="size-3.5" icon={Copy01Icon} />
                </ArtifactPanelChromeButton>
            </div>
        </div>
    );
}

function ArtifactPanelBreadcrumb({
    onOpenTarget,
    target,
}: {
    onOpenTarget: (target: TavernResourceTarget) => void;
    target: TavernResourceTarget;
}) {
    const segments = getArtifactPanelBreadcrumbSegments(target);

    return (
        <Breadcrumb aria-label="Artifact source" className="min-w-0" title={target.path}>
            <BreadcrumbList className="min-w-0 flex-nowrap gap-1 overflow-hidden text-[0.8125rem] sm:gap-1">
                {segments.map((segment) => (
                    <ArtifactPanelBreadcrumbSegment
                        key={segment.key}
                        onOpenTarget={onOpenTarget}
                        segment={segment}
                    />
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

function ArtifactPanelBreadcrumbSegment({
    onOpenTarget,
    segment,
}: {
    onOpenTarget: (target: TavernResourceTarget) => void;
    segment: ArtifactPanelBreadcrumbSegmentData;
}) {
    const SegmentIcon = segment.kind === 'directory' ? Folder01Icon : File01Icon;

    return (
        <>
            {segment.first ? null : (
                <BreadcrumbSeparator className="shrink-0 opacity-45 [&>svg]:size-3" />
            )}
            <BreadcrumbItem
                className={cn(segment.current ? 'min-w-0 max-w-48' : 'min-w-0 max-w-24')}
            >
                {segment.current ? (
                    <BreadcrumbPage className="flex min-w-0 items-center gap-1 font-medium">
                        <Icon aria-hidden="true" className="size-3.5 shrink-0" icon={SegmentIcon} />
                        <span className="truncate">{segment.label}</span>
                    </BreadcrumbPage>
                ) : segment.target ? (
                    <button
                        className="-my-1 flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                        onClick={() => onOpenTarget(segment.target as TavernResourceTarget)}
                        title={segment.path}
                        type="button"
                    >
                        <span className="truncate">{segment.label}</span>
                    </button>
                ) : (
                    <span className="min-w-0 truncate text-muted-foreground">{segment.label}</span>
                )}
            </BreadcrumbItem>
        </>
    );
}

function ArtifactPanelChromeButton({
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button className={artifactPanelChromeButtonClassName} type="button" {...props}>
            {children}
        </button>
    );
}

const artifactPanelChromeButtonClassName =
    'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground';

function getArtifactPanelBreadcrumbSegments(target: TavernResourceTarget) {
    const root = isVaultTarget(target) ? 'vault' : 'workspace';
    const pathSegments = target.path.split('/').filter(Boolean);
    let keyPath = root;

    return [
        {
            current: pathSegments.length === 0,
            first: true,
            kind: 'directory' as const,
            key: root,
            label: root,
            path: '',
            target: getArtifactPanelDirectoryTarget(target, ''),
        },
        ...pathSegments.map((segment, index) => {
            keyPath = `${keyPath}/${segment}`;
            const prefix = pathSegments.slice(0, index + 1).join('/');
            const current = index === pathSegments.length - 1;
            const directory = current ? isDirectoryTarget(target) : true;
            return {
                current,
                first: false,
                kind: directory ? ('directory' as const) : ('file' as const),
                key: keyPath,
                label: segment,
                path: prefix,
                target: current ? null : getArtifactPanelDirectoryTarget(target, prefix),
            };
        }),
    ];
}

interface ArtifactPanelBreadcrumbSegmentData {
    current: boolean;
    first: boolean;
    key: string;
    kind: 'directory' | 'file';
    label: string;
    path: string;
    target: TavernResourceTarget | null;
}

function getArtifactPanelDirectoryTarget(target: TavernResourceTarget, path: string) {
    if (isVaultTarget(target)) {
        return { kind: 'vaultDirectory', path } as const;
    }

    return { kind: 'workspaceDirectory', path } as const;
}

function getArtifactPanelOpenHref(target: TavernResourceTarget) {
    if (target.kind === 'vaultPage' || target.kind === 'vaultDirectory') {
        return `${appRoutes.memory}?path=${encodeURIComponent(target.path)}`;
    }

    return null;
}

function isVaultTarget(target: TavernResourceTarget) {
    return target.kind === 'vaultPage' || target.kind === 'vaultDirectory';
}

function isDirectoryTarget(target: TavernResourceTarget) {
    return (
        target.kind === 'vaultDirectory' ||
        target.kind === 'workspaceDirectory' ||
        target.kind === 'workspaceRoot'
    );
}

async function copyArtifactText(value: string) {
    if (navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // Fall through to the textarea copy path for stricter webviews.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.append(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
    } finally {
        textarea.remove();
    }
}
