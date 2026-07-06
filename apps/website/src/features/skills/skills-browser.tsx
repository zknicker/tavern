import {
    Folder01Icon,
    FolderImportIcon,
    LibraryIcon,
    MagicWand01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
} from '../../components/ui/sidebar.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { type SkillEnablementController, SkillPreviewPane } from './skill-preview-pane.tsx';
import {
    buildSkillTreePaths,
    buildSkillTreeSubjects,
    type HubByName,
    type RuntimeManagedByName,
} from './skill-tree-model.ts';
import { SkillsFileTree } from './skills-file-tree.tsx';

type SkillSummary = SkillListOutput['skills'][number];

export function SkillsBrowser({
    hubByName,
    onAddFromLibrary,
    onManageSources,
    runtimeByName,
    skillEnablement,
    skills,
}: {
    hubByName: HubByName;
    onAddFromLibrary: () => void;
    onManageSources: () => void;
    runtimeByName?: RuntimeManagedByName;
    skillEnablement?: SkillEnablementController;
    skills: SkillSummary[];
}) {
    const [selectedPath, setSelectedPath] = React.useState<null | string>(null);
    const sidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 380,
        minWidth: 240,
        storageKey: 'tavern.skills.sidebar.width',
    });
    const subjects = React.useMemo(
        () => buildSkillTreeSubjects({ hubByName, runtimeByName, skills }),
        [hubByName, runtimeByName, skills]
    );
    const paths = React.useMemo(() => buildSkillTreePaths(subjects), [subjects]);
    const subjectsByPath = React.useMemo(
        () => new Map(subjects.map((subject) => [subject.treePath, subject])),
        [subjects]
    );

    React.useEffect(() => {
        if (selectedPath && subjectsByPath.has(selectedPath)) {
            return;
        }
        setSelectedPath(subjects[0]?.treePath ?? null);
    }, [selectedPath, subjects, subjectsByPath]);

    const selectedSubject = selectedPath ? (subjectsByPath.get(selectedPath) ?? null) : null;

    return (
        <div
            className="grid h-full min-h-0 flex-1 overflow-hidden bg-background"
            style={{ gridTemplateColumns: `${sidebarWidth.width}px minmax(0, 1fr)` }}
        >
            <aside className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-x-hidden border-border/70 border-r bg-background text-sidebar-foreground">
                <ResizablePaneRail
                    maxWidth={380}
                    minWidth={240}
                    onWidthChange={sidebarWidth.setWidth}
                    onWidthCommit={sidebarWidth.persistWidth}
                    side="right"
                    width={sidebarWidth.width}
                />
                <SidebarHeader className="gap-0 border-border/70 border-b px-3 pt-4 pb-2">
                    <div className="flex h-6 items-center gap-3">
                        <h2 className="min-w-0 flex-1 truncate font-semibold text-base text-foreground">
                            Skills
                        </h2>
                        <Button
                            aria-label="Manage skill sources"
                            className="size-7 text-muted-foreground"
                            onClick={onManageSources}
                            size="icon-sm"
                            title="Manage sources"
                            variant="ghost"
                        >
                            <Icon className="size-4" icon={Folder01Icon} />
                        </Button>
                    </div>
                    <div className="mt-3 grid gap-1">
                        <SkillSidebarCommand
                            icon={FolderImportIcon}
                            label="Import from folder"
                            onClick={onManageSources}
                        />
                        <SkillSidebarCommand
                            icon={MagicWand01Icon}
                            label="Create new skill"
                            onClick={() => undefined}
                        />
                        <SkillSidebarCommand
                            icon={LibraryIcon}
                            label="Add from library"
                            onClick={onAddFromLibrary}
                        />
                    </div>
                </SidebarHeader>
                <div className="flex h-10 shrink-0 items-center border-border/70 border-b px-3 font-medium text-muted-foreground text-sm">
                    Browse skills
                </div>
                <SidebarContent className="min-h-0 flex-1 overflow-x-hidden">
                    <SidebarGroup className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-1 py-0">
                        <SidebarGroupContent className="flex min-h-0 flex-1 overflow-x-hidden">
                            <SkillsFileTree
                                onSelect={(subject) => setSelectedPath(subject.treePath)}
                                paths={paths}
                                query=""
                                selectedPath={selectedPath}
                                subjectsByPath={subjectsByPath}
                            />
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </aside>
            <main className="flex min-h-0 min-w-0 flex-col">
                <SkillPreviewPane skillEnablement={skillEnablement} subject={selectedSubject} />
            </main>
        </div>
    );
}

function SkillSidebarCommand({
    icon,
    label,
    onClick,
}: {
    icon: React.ComponentProps<typeof Icon>['icon'];
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            className="-mx-1 flex h-7 items-center gap-2 rounded-md px-1 font-semibold text-foreground text-sm transition-colors hover:bg-sidebar-accent"
            onClick={onClick}
            type="button"
        >
            <Icon className="size-4 text-muted-foreground" icon={icon} />
            <span className="truncate">{label}</span>
        </button>
    );
}
