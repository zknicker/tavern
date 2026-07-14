import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { ResizablePaneRail } from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Tabs } from '../../components/ui/tabs.tsx';
import {
    artifactPaneWidthLimits,
    useArtifactPaneWidth,
} from '../../hooks/pane/use-artifact-pane-width.ts';
import type { ChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { useWikiPage } from '../../hooks/wiki/use-wiki-page.ts';
import { cn } from '../../lib/utils.ts';
import { WikiMarkdownViewer } from '../wiki/wiki-markdown-viewer.tsx';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
import { WikiBrowserContent } from './chat-artifact-wiki-content.tsx';
import { WorkspaceBrowserContent } from './chat-artifact-workspace-content.tsx';
import {
    getArtifactPanelTargetKey,
    isWorkspaceChatPaneTarget,
    type TavernResourceTarget,
} from './tavern-resource-link.ts';

export function ChatArtifactPanel({
    agentId,
    chromeHidden = false,
    state,
}: {
    agentId: string;
    // True when the shell toolbar hosts the pane chrome (tabs layout).
    chromeHidden?: boolean;
    state: ChatArtifactPanelState;
}) {
    const shouldReduceMotion = useReducedMotion();
    const open = state.visible;
    const [resizingArtifactPane, setResizingArtifactPane] = React.useState(false);
    const artifactPaneWidth = useArtifactPaneWidth();

    return (
        <AnimatePresence initial={false}>
            {open ? (
                <motion.aside
                    animate={{ opacity: 1, width: artifactPaneWidth.width, x: 0 }}
                    aria-label="Artifacts"
                    className="relative z-[36] flex h-full min-h-0 shrink-0 overflow-hidden border-border/70 border-l bg-background/96 shadow-2xl shadow-black/8"
                    exit={{ opacity: 0, width: 0, x: 36 }}
                    initial={shouldReduceMotion ? false : { opacity: 0, width: 0, x: 36 }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0.12 }
                            : {
                                  opacity: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                                  width: {
                                      duration: resizingArtifactPane ? 0 : 0.28,
                                      ease: [0.16, 1, 0.3, 1],
                                  },
                                  x: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                              }
                    }
                >
                    <ResizablePaneRail
                        maxWidth={artifactPaneWidthLimits.max}
                        minWidth={artifactPaneWidthLimits.min}
                        onResizeEnd={() => setResizingArtifactPane(false)}
                        onResizeStart={() => setResizingArtifactPane(true)}
                        onWidthChange={artifactPaneWidth.setWidth}
                        onWidthCommit={artifactPaneWidth.persistWidth}
                        side="left"
                        width={artifactPaneWidth.width}
                    />
                    <ArtifactPanelBody
                        agentId={agentId}
                        chromeHidden={chromeHidden}
                        state={state}
                        width={artifactPaneWidth.width}
                    />
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
}

// The pane renders only the active target's content; tab selection is
// controlled state, not Base UI panel matching, because in the tabs layout
// the tab triggers live in the shell toolbar's own Tabs root.
function ArtifactPanelBody({
    agentId,
    chromeHidden,
    state,
    width,
}: {
    agentId: string;
    chromeHidden: boolean;
    state: ChatArtifactPanelState;
    width: number;
}) {
    const activeTarget = state.targets.find(
        (target) => getArtifactPanelTargetKey(target) === state.activeKey
    );

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ width }}>
            {chromeHidden ? null : (
                <div className="shrink-0 border-border/70 border-b">
                    <Tabs
                        className="flex items-center"
                        onValueChange={state.setActiveKey}
                        value={state.activeKey ?? undefined}
                    >
                        <ArtifactPanelChrome
                            activeKey={state.activeKey}
                            activeTarget={activeTarget}
                            agentId={agentId}
                            onClose={state.toggleVisible}
                            onCloseTarget={state.closeTarget}
                            onOpenTarget={state.open}
                            targets={state.targets}
                        />
                    </Tabs>
                </div>
            )}
            <div className="min-h-0 flex-1">
                {activeTarget ? (
                    <ArtifactPanelContent
                        agentId={agentId}
                        // Workspace targets share one tab whose file selection
                        // morphs the target; a stable key keeps the browser
                        // (tree state, loaded folders) mounted across morphs.
                        key={
                            isWorkspaceChatPaneTarget(activeTarget) ? 'workspace' : state.activeKey
                        }
                        onOpenTarget={state.open}
                        target={activeTarget}
                    />
                ) : (
                    <ArtifactPanelEmpty
                        detail="Open a workspace file or Wiki page from the + menu, or click a linked output in chat."
                        title="No artifacts open"
                    />
                )}
            </div>
        </div>
    );
}

function ArtifactPanelContent({
    agentId,
    onOpenTarget,
    target,
}: {
    agentId: string;
    onOpenTarget: (target: TavernResourceTarget) => void;
    target: TavernResourceTarget;
}) {
    if (target.kind === 'wikiPage') {
        return <WikiArtifactContent target={target} />;
    }

    if (target.kind === 'wikiDirectory') {
        return <WikiBrowserContent initialDirectoryPath={target.path} />;
    }

    // The workspace is one unified tab: file content plus the workspace tree.
    // Picking a file in the tree morphs this tab's target in place, so the
    // tab title follows the open file.
    return (
        <WorkspaceBrowserContent
            agentId={agentId}
            initialDirectoryPath={workspaceInitialDirectory(target)}
            onSelectPath={(path) => {
                if (path) {
                    onOpenTarget({ kind: 'workspaceFile', path });
                }
            }}
            selectedPath={target.kind === 'workspaceFile' ? target.path : null}
        />
    );
}

function workspaceInitialDirectory(target: TavernResourceTarget) {
    if (target.kind === 'workspaceFile') {
        return target.path.split('/').slice(0, -1).join('/');
    }
    return target.path;
}

function WikiArtifactContent({
    target,
}: {
    target: Extract<TavernResourceTarget, { kind: 'wikiPage' }>;
}) {
    const pageQuery = useWikiPage({ path: target.path });

    if (pageQuery.isPending) {
        return <ArtifactPanelEmpty detail="Loading Wiki page..." title={target.path} />;
    }

    if (pageQuery.error) {
        return <ArtifactPanelEmpty detail="Unable to load this Wiki page." title={target.path} />;
    }

    if (!pageQuery.data) {
        return (
            <ArtifactPanelEmpty detail="No Wiki page exists at this path." title={target.path} />
        );
    }

    return (
        <ScrollArea className="h-full min-h-0" scrollFade>
            <article className="mx-auto max-w-[42rem] px-7 pt-7 pb-12">
                <WikiMarkdownViewer value={pageQuery.data.body} />
            </article>
        </ScrollArea>
    );
}

function ArtifactPanelEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className={cn('mt-1 text-muted-foreground text-sm leading-6')}>{detail}</div>
            </div>
        </div>
    );
}
