import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { ResizablePaneRail } from '../../components/ui/resizable-pane-rail.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { TabPanel, Tabs } from '../../components/ui/tabs.tsx';
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
import { WorkspaceArtifactContent } from './chat-artifact-workspace-preview.tsx';
import { getArtifactPanelTargetKey, type TavernResourceTarget } from './tavern-resource-link.ts';

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
                    <div
                        className="flex h-full min-h-0 flex-col"
                        style={{ width: artifactPaneWidth.width }}
                    >
                        <Tabs
                            className="flex min-h-0 flex-1 flex-col"
                            onValueChange={state.setActiveKey}
                            value={state.activeKey ?? undefined}
                        >
                            {chromeHidden ? null : (
                                <div className="shrink-0 border-border/70 border-b">
                                    <ArtifactPanelChrome
                                        activeKey={state.activeKey}
                                        activeTarget={state.targets.find(
                                            (target) =>
                                                getArtifactPanelTargetKey(target) ===
                                                state.activeKey
                                        )}
                                        agentId={agentId}
                                        onClose={state.toggleVisible}
                                        onCloseTarget={state.closeTarget}
                                        onOpenTarget={state.open}
                                        targets={state.targets}
                                    />
                                </div>
                            )}
                            <div className="min-h-0 flex-1">
                                {state.targets.length === 0 ? (
                                    <ArtifactPanelEmpty
                                        detail="Open a workspace file or Wiki page from the + menu, or click a linked output in chat."
                                        title="No artifacts open"
                                    />
                                ) : null}
                                {state.targets.map((target) => (
                                    <TabPanel
                                        className="h-full min-h-0"
                                        key={getArtifactPanelTargetKey(target)}
                                        value={getArtifactPanelTargetKey(target)}
                                    >
                                        <ArtifactPanelContent agentId={agentId} target={target} />
                                    </TabPanel>
                                ))}
                            </div>
                        </Tabs>
                    </div>
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
}

function ArtifactPanelContent({
    agentId,
    target,
}: {
    agentId: string;
    target: TavernResourceTarget;
}) {
    if (target.kind === 'wikiPage') {
        return <WikiArtifactContent target={target} />;
    }

    if (target.kind === 'wikiDirectory') {
        return <WikiBrowserContent initialDirectoryPath={target.path} />;
    }

    if (target.kind === 'workspaceRoot' || target.kind === 'workspaceDirectory') {
        return <WorkspaceBrowserContent agentId={agentId} initialDirectoryPath={target.path} />;
    }

    return <WorkspaceArtifactContent agentId={agentId} target={target} />;
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
